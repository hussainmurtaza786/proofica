import "server-only";

import { prisma } from "@/lib/prisma";
import { computeDurationHours } from "@/lib/rental-math";
import type { Prisma } from "@prisma/client";

/**
 * Checks whether an asset is available for the requested window.
 * Overlapping reservations in active states block the asset.
 * Also rejects assets whose current status cannot be rented.
 *
 * Pass a transaction client as `db` when calling inside a booking
 * transaction that holds a row lock on the asset.
 */
export async function isAssetAvailable(
  orgId: string,
  assetId: string,
  startAt: Date,
  endAt: Date,
  excludeRentalId?: string,
  db: Prisma.TransactionClient = prisma as unknown as Prisma.TransactionClient
): Promise<{ available: boolean; conflicts: { rentalNo: string; startAt: Date; expectedReturnAt: Date; status: string }[] }> {
  const blockingStatuses = [
    "reserved",
    "awaiting_handover",
    "active",
    "due_soon",
    "overdue",
    "returned",
    "inspection_pending",
  ];

  const asset = await db.asset.findFirst({ where: { id: assetId, orgId } });
  if (!asset) return { available: false, conflicts: [] };

  if (!["available", "reserved"].includes(asset.status)) {
    return {
      available: false,
      conflicts: [{ rentalNo: asset.assetNo, startAt, expectedReturnAt: endAt, status: `asset_${asset.status}` }],
    };
  }

  const conflicts = await db.rental.findMany({
    where: {
      orgId,
      assetId,
      id: excludeRentalId ? { not: excludeRentalId } : undefined,
      status: { in: blockingStatuses },
      AND: [
        { startAt: { lt: endAt } },
        { expectedReturnAt: { gt: startAt } },
      ],
    },
    select: { rentalNo: true, startAt: true, expectedReturnAt: true, status: true },
  });

  return { available: conflicts.length === 0, conflicts };
}

/**
 * Booked windows for the calendar (active/reserved rentals + maintenance).
 */
export async function getAssetBookings(orgId: string, assetId?: string) {
  const rentals = await prisma.rental.findMany({
    where: {
      orgId,
      assetId,
      status: { in: ["reserved", "awaiting_handover", "active", "due_soon", "overdue"] },
    },
    select: {
      id: true,
      rentalNo: true,
      startAt: true,
      expectedReturnAt: true,
      status: true,
      assetId: true,
      customer: { select: { name: true } },
      asset: { select: { name: true, assetNo: true } },
    },
  });

  const maintenance = await prisma.maintenance.findMany({
    where: { orgId, assetId, status: { in: ["scheduled", "in_progress"] } },
    select: {
      id: true,
      type: true,
      date: true,
      nextDate: true,
      assetId: true,
      asset: { select: { name: true, assetNo: true } },
    },
  });

  return { rentals, maintenance };
}

export function rentalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export { computeDurationHours };
