import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Generates the next sequential number for an org, e.g. R-000042.
 *
 * Numbers are claimed atomically via an UPSERT that increments a per-org
 * counter row (see the Sequence model). Concurrent creates can never
 * observe the same value, unlike a max+1 table scan.
 *
 * If no counter row exists yet (legacy data), it is seeded from the current
 * maximum before claiming, inside one transaction.
 */

type CounterModel = "rental" | "customer" | "asset";

const CONFIG: Record<CounterModel, { prefix: string; pad: number }> = {
  rental: { prefix: "R", pad: 5 },
  customer: { prefix: "C", pad: 5 },
  asset: { prefix: "AST", pad: 5 },
};

const COLUMN: Record<CounterModel, string> = {
  rental: "rentalNo",
  customer: "customerNo",
  asset: "assetNo",
};

async function seedCounter(orgId: string, model: CounterModel): Promise<void> {
  const col = COLUMN[model];
  const table = model === "rental" ? "Rental" : model === "customer" ? "Customer" : "Asset";
  const key = `${orgId}:${model}`;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.sequence.findUnique({ where: { key } });
    if (existing) return;

    const rows = await tx.$queryRawUnsafe<{ no: number | null }[]>(
      `SELECT MAX((regexp_match("${col}"::text, '\\d+$'))[1]::int) AS no FROM "${table}" WHERE "orgId" = $1`,
      orgId
    );
    const max = rows[0]?.no ?? 0;

    // ON CONFLICT guards against a concurrent seeder winning the race.
    await tx.$executeRawUnsafe(
      `INSERT INTO "Sequence" ("key", "value") VALUES ($1, $2)
       ON CONFLICT ("key") DO NOTHING`,
      key,
      max
    );
  });
}

async function nextNumber(
  orgId: string,
  model: CounterModel,
): Promise<string> {
  const key = `${orgId}:${model}`;

  let seeded = await prisma.sequence.findUnique({ where: { key }, select: { key: true } });
  if (!seeded) {
    await seedCounter(orgId, model);
    seeded = await prisma.sequence.findUnique({ where: { key }, select: { key: true } });
  }
  if (!seeded) throw new Error(`Could not initialize ${model} counter`);

  // Atomic claim: INSERT ... ON CONFLICT DO UPDATE ... RETURNING.
  const claimed = await prisma.$queryRawUnsafe<{ value: number }[]>(
    `INSERT INTO "Sequence" ("key", "value") VALUES ($1, 1)
     ON CONFLICT ("key") DO UPDATE SET "value" = "Sequence"."value" + 1
     RETURNING "value"`,
    key
  );
  const value = claimed[0]?.value ?? 1;

  const { prefix, pad } = CONFIG[model];
  return `${prefix}-${String(value).padStart(pad, "0")}`;
}

export const nextRentalNo = (orgId: string) => nextNumber(orgId, "rental");
export const nextCustomerNo = (orgId: string) => nextNumber(orgId, "customer");
export const nextAssetNo = (orgId: string) => nextNumber(orgId, "asset");
