/**
 * Repairs rental ledgers written before the deposit/revenue split.
 *
 * Recomputes for every rental, strictly from history:
 *   - depositPaid = sum of completed "deposit" payments
 *   - amountPaid  = sum of completed non-deposit payments minus refunds (>= 0)
 *   - balance     = totalAmount - amountPaid
 *   - depositHeld = depositPaid - settled deposits (refunded/deducted/forfeited)
 *
 * Usage:
 *   npx tsx scripts/repair-deposit-ledger.ts           # dry run (report only)
 *   npx tsx scripts/repair-deposit-ledger.ts --apply   # write corrections
 */
import "dotenv/config";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { applyPaymentToLedger, applyDepositSettlement } from "../src/lib/rental-math";

const apply = process.argv.includes("--apply");

const dec = (v: Prisma.Decimal | number | string) => (v instanceof Prisma.Decimal ? v : new Prisma.Decimal(v));
const eq = (a: Prisma.Decimal | number | string, b: Prisma.Decimal | number | string) => dec(a).eq(dec(b));

async function main() {
  const rentals = await prisma.rental.findMany({
    include: { payments: true, deposits: { select: { id: true } } },
  });

  let broken = 0;
  let repaired = 0;

  for (const rental of rentals) {
    const completed = rental.payments.filter((p) => p.status === "completed");

    let ledger = {
      amountPaid: new Prisma.Decimal(0),
      depositPaid: new Prisma.Decimal(0),
      depositHeld: new Prisma.Decimal(0),
      balance: dec(rental.totalAmount),
    };
    for (const p of completed) {
      const next = applyPaymentToLedger({
        ...ledger,
        totalAmount: rental.totalAmount,
        type: p.type,
        amount: p.amount,
      });
      ledger = {
        amountPaid: next.amountPaid,
        depositPaid: next.depositPaid,
        depositHeld: next.depositHeld,
        balance: next.balance,
      };
    }

    // Deposit settlements live in DepositTransaction (no Payment rows), so
    // they are subtracted from held custody only — never from revenue.
    const depositIds = rental.deposits.map((d) => d.id);
    let settled = new Prisma.Decimal(0);
    if (depositIds.length > 0) {
      const agg = await prisma.depositTransaction.aggregate({
        where: { depositId: { in: depositIds }, type: { in: ["refunded", "deducted", "forfeited"] } },
        _sum: { amount: true },
      });
      settled = agg._sum.amount ?? new Prisma.Decimal(0);
    }
    const depositHeld = applyDepositSettlement({
      depositHeld: ledger.depositHeld,
      refund: settled,
      totalDeduction: 0,
    });

    const diffs: string[] = [];
    if (!eq(rental.depositPaid, ledger.depositPaid)) {
      diffs.push(`depositPaid ${rental.depositPaid} -> ${ledger.depositPaid}`);
    }
    if (!eq(rental.amountPaid, ledger.amountPaid)) {
      diffs.push(`amountPaid ${rental.amountPaid} -> ${ledger.amountPaid}`);
    }
    if (!eq(rental.balance, ledger.balance)) {
      diffs.push(`balance ${rental.balance} -> ${ledger.balance}`);
    }
    if (!eq(rental.depositHeld, depositHeld)) {
      diffs.push(`depositHeld ${rental.depositHeld} -> ${depositHeld}`);
    }

    if (diffs.length === 0) continue;
    broken++;
    console.log(`[${apply ? "FIX" : "DRY"}] Rental ${rental.rentalNo} (${rental.orgId}): ${diffs.join("; ")}`);

    if (apply) {
      await prisma.rental.update({
        where: { id: rental.id },
        data: {
          depositPaid: ledger.depositPaid,
          amountPaid: ledger.amountPaid,
          balance: ledger.balance,
          depositHeld,
        },
      });
      repaired++;
    }
  }

  console.log(
    apply
      ? `Done. ${broken} rental(s) out of sync, ${repaired} repaired.`
      : `Dry run. ${broken} rental(s) out of sync. Re-run with --apply to fix.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
