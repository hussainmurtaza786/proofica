import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Generates the next sequential number for an org, e.g. R-000042.
 * Format is configurable per model.
 */
async function nextNumber(
  orgId: string,
  model: "rental" | "customer" | "asset",
  prefix: string,
  pad = 5
): Promise<string> {
  const col = model === "rental" ? "rentalNo" : model === "customer" ? "customerNo" : "assetNo";
  const table = model === "rental" ? "Rental" : model === "customer" ? "Customer" : "Asset";
  const rows = await prisma.$queryRawUnsafe<{ no: string }[]>(
    `SELECT "${col}" AS no FROM "${table}" WHERE "orgId" = $1`,
    orgId
  );

  let max = 0;
  for (const row of rows) {
    const match = row.no.match(/(\d+)$/);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `${prefix}-${String(max + 1).padStart(pad, "0")}`;
}

export const nextRentalNo = (orgId: string) => nextNumber(orgId, "rental", "R");
export const nextCustomerNo = (orgId: string) => nextNumber(orgId, "customer", "C");
export const nextAssetNo = (orgId: string) => nextNumber(orgId, "asset", "AST");
