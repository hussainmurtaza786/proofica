"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/services/access";
import { paymentSchema, depositRefundSchema } from "@/lib/validators";
import { PERMISSIONS } from "@/lib/constants";
import { toDecimal } from "@/lib/decimal";
import { audit } from "@/services/audit";
import { notify } from "@/services/notify";
import { getOrgSettings } from "@/services/settings";
import { computeDepositRefund, applyPaymentToLedger, applyDepositSettlement } from "@/lib/rental-math";
import type { ActionResult } from "@/lib/actions";

export async function recordPayment(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission(PERMISSIONS.recordPayment);
  const parsed = paymentSchema.safeParse({
    rentalId: formData.get("rentalId"),
    amount: formData.get("amount"),
    method: formData.get("method"),
    type: formData.get("type"),
    reference: formData.get("reference"),
    notes: formData.get("notes"),
    receivedAt: formData.get("receivedAt"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const rental = await prisma.rental.findFirst({ where: { id: data.rentalId, orgId: ctx.orgId } });
  if (!rental) return { ok: false, error: "Rental not found" };

  const amount = toDecimal(data.amount);

  await prisma.$transaction(async (tx) => {
    // Payments are immutable records.
    await tx.payment.create({
      data: {
        orgId: ctx.orgId,
        rentalId: data.rentalId,
        customerId: rental.customerId,
        amount,
        method: data.method,
        type: data.type,
        reference: data.reference || null,
        notes: data.notes || null,
        receivedBy: ctx.userId,
        receivedAt: data.receivedAt ? new Date(data.receivedAt) : new Date(),
      },
    });

    if (data.type === "deposit") {
      const deposit = await tx.deposit.findFirst({
        where: { rentalId: data.rentalId, orgId: ctx.orgId },
      });
      if (deposit) {
        await tx.deposit.update({
          where: { id: deposit.id },
          data: { status: "held", heldAt: new Date() },
        });
        await tx.depositTransaction.create({
          data: {
            orgId: ctx.orgId,
            depositId: deposit.id,
            type: "received",
            amount,
            reason: "Deposit received",
            createdBy: ctx.userId,
          },
        });
      }
    }

    // Deposit cash is tracked separately from rental revenue.
    const ledger = applyPaymentToLedger({
      totalAmount: rental.totalAmount,
      amountPaid: rental.amountPaid,
      depositPaid: rental.depositPaid,
      depositHeld: rental.depositHeld,
      type: data.type,
      amount,
    });

    await tx.rental.update({
      where: { id: data.rentalId },
      data: {
        amountPaid: ledger.amountPaid,
        balance: ledger.balance,
        depositPaid: ledger.depositPaid,
        depositHeld: ledger.depositHeld,
      },
    });
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: "payment",
    entityType: "rental",
    entityId: data.rentalId,
    description: `Recorded ${data.method} payment of ${amount} (${data.type}) on ${rental.rentalNo}`,
  });

  revalidatePath(`/rentals/${data.rentalId}`);
  return { ok: true, message: "Payment recorded" };
}

export async function finalizeDepositReturn(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission(PERMISSIONS.recordPayment);
  const parsed = depositRefundSchema.safeParse({
    depositId: formData.get("depositId"),
    deductions: (() => { try { return JSON.parse(String(formData.get("deductions") ?? "[]")); } catch { return []; } })(),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid deductions" };
  const data = parsed.data;

  const deposit = await prisma.deposit.findFirst({
    where: { id: data.depositId, orgId: ctx.orgId },
    include: { rental: true },
  });
  if (!deposit) return { ok: false, error: "Deposit not found" };

  const { totalDeduction, refund } = computeDepositRefund({
    held: deposit.amount,
    deductions: data.deductions,
  });

  const settings = await getOrgSettings(ctx.orgId);
  const authThreshold = settings.rentalRules.depositDeductionAuthThreshold;

  if (totalDeduction.greaterThan(authThreshold)) {
    const allowed = await prisma.organizationMember.findFirst({
      where: { orgId: ctx.orgId, userId: ctx.userId, role: { in: ["Owner", "Admin", "Manager"] } },
    });
    if (!allowed) {
      return {
        ok: false,
        error: `Deductions above ${authThreshold} require authorization from an Owner, Admin or Manager.`,
      };
    }
  }

  const newStatus =
    totalDeduction.isZero()
      ? "returned"
      : refund.isZero()
        ? "deducted"
        : "partially_returned";

  await prisma.$transaction(async (tx) => {
    for (const deduction of data.deductions) {
      if (deduction.amount > 0) {
        await tx.depositTransaction.create({
          data: {
            orgId: ctx.orgId,
            depositId: deposit.id,
            type: "deducted",
            amount: toDecimal(deduction.amount),
            reason: deduction.reason,
            authorizedBy: ctx.userId,
            createdBy: ctx.userId,
          },
        });
      }
    }

    if (refund.greaterThan(0)) {
      await tx.depositTransaction.create({
        data: {
          orgId: ctx.orgId,
          depositId: deposit.id,
          type: "refunded",
          amount: refund,
          reason: "Deposit refund after deductions",
          createdBy: ctx.userId,
        },
      });
    }

    await tx.deposit.update({
      where: { id: deposit.id },
      data: { status: newStatus, returnedAt: new Date(), notes: `Refund: ${refund}, Deductions: ${totalDeduction}` },
    });

    // Refunds and deductions both release funds from custody. Rental
    // revenue (amountPaid/balance) is never touched by deposit settlement.
    const newDepositHeld = applyDepositSettlement({
      depositHeld: deposit.rental.depositHeld,
      refund,
      totalDeduction,
    });
    await tx.rental.update({
      where: { id: deposit.rental.id },
      data: { depositHeld: newDepositHeld },
    });
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: "refund",
    entityType: "deposit",
    entityId: deposit.id,
    description: `Deposit on ${deposit.rental.rentalNo}: refunded ${refund}, deducted ${totalDeduction}`,
  });

  revalidatePath(`/rentals/${deposit.rentalId}`);
  return { ok: true, message: "Deposit finalized" };
}

export async function recordPaymentForRental(
  rentalId: string,
  amount: number,
  type: "rental" | "deposit" | "additional" | "late" | "damage",
  notes: string
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requirePermission(PERMISSIONS.recordPayment);
  const rental = await prisma.rental.findFirst({ where: { id: rentalId, orgId: ctx.orgId } });
  if (!rental) return { ok: false, error: "Rental not found" };

  const value = toDecimal(amount);
  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        orgId: ctx.orgId,
        rentalId,
        customerId: rental.customerId,
        amount: value,
        method: "cash",
        type,
        notes,
        receivedBy: ctx.userId,
      },
    });
    if (type === "deposit") {
      const deposit = await tx.deposit.findFirst({ where: { rentalId, orgId: ctx.orgId } });
      if (deposit) {
        await tx.deposit.update({ where: { id: deposit.id }, data: { status: "held", heldAt: new Date() } });
        await tx.depositTransaction.create({
          data: { orgId: ctx.orgId, depositId: deposit.id, type: "received", amount: value, createdBy: ctx.userId },
        });
      }
    }
    const ledger = applyPaymentToLedger({
      totalAmount: rental.totalAmount,
      amountPaid: rental.amountPaid,
      depositPaid: rental.depositPaid,
      depositHeld: rental.depositHeld,
      type,
      amount: value,
    });
    await tx.rental.update({
      where: { id: rentalId },
      data: {
        amountPaid: ledger.amountPaid,
        balance: ledger.balance,
        depositPaid: ledger.depositPaid,
        depositHeld: ledger.depositHeld,
      },
    });
  });

  await notify({
    orgId: ctx.orgId,
    type: "payment_received",
    title: "Payment received",
    body: `Payment of ${value} recorded on ${rental.rentalNo}.`,
    link: `/rentals/${rentalId}`,
  });

  return { ok: true };
}
