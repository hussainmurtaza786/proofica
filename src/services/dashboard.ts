import "server-only";

import { prisma } from "@/lib/prisma";
import { toDecimal } from "@/lib/decimal";

export type DateRange = "today" | "week" | "month" | "lastMonth" | "year" | "custom";

export function dateRangeBounds(range: DateRange, customFrom?: Date, customTo?: Date): { from: Date; to: Date } {
  const now = new Date();
  switch (range) {
    case "today": {
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { from, to: now };
    }
    case "week": {
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      return { from, to: now };
    }
    case "month": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from, to: now };
    }
    case "lastMonth": {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from, to };
    }
    case "year": {
      const from = new Date(now.getFullYear(), 0, 1);
      return { from, to: now };
    }
    case "custom":
      return { from: customFrom ?? new Date(0), to: customTo ?? now };
  }
}

export async function getDashboardData(orgId: string, range: DateRange = "month") {
  const { from, to } = dateRangeBounds(range);

  const [
    assets,
    activeRentals,
    dueToday,
    overdueRentals,
    upcomingRentals,
    customers,
    revenueAgg,
    expenseAgg,
    depositsHeldAgg,
    outstanding,
    damageCount,
    maintenanceDue,
    rentalsThisPeriod,
    expensesThisPeriod,
  ] = await Promise.all([
    prisma.asset.findMany({ where: { orgId }, select: { id: true, status: true } }),
    prisma.rental.count({
      where: { orgId, status: { in: ["active", "due_soon", "overdue"] } },
    }),
    prisma.rental.count({
      where: {
        orgId,
        status: { in: ["active", "due_soon"] },
        expectedReturnAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()),
          lt: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 1),
        },
      },
    }),
    prisma.rental.count({ where: { orgId, status: "overdue" } }),
    prisma.rental.count({
      where: {
        orgId,
        status: { in: ["reserved", "awaiting_handover"] },
        startAt: { gte: new Date() },
      },
    }),
    prisma.customer.count({ where: { orgId, status: { not: "archived" } } }),
    prisma.payment.aggregate({
      where: { orgId, type: { in: ["rental", "additional", "late", "damage"] }, receivedAt: { gte: from, lte: to } },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { orgId, date: { gte: from, lte: to } },
      _sum: { amount: true },
    }),
    prisma.deposit.aggregate({
      where: { orgId, status: { in: ["held", "partially_returned", "pending"] } },
      _sum: { amount: true },
    }),
    prisma.rental.aggregate({
      where: { orgId, status: { not: "cancelled" }, balance: { gt: 0 } },
      _sum: { balance: true },
    }),
    prisma.damage.count({
      where: { orgId, status: { in: ["reported", "under_review", "customer_disputed", "approved", "repair_pending", "repairing"] } },
    }),
    prisma.maintenance.count({
      where: { orgId, status: { in: ["scheduled", "in_progress", "overdue"] } },
    }),
    prisma.rental.findMany({
      where: { orgId, createdAt: { gte: from, lte: to }, status: { not: "cancelled" } },
      select: { id: true, createdAt: true, totalAmount: true },
    }),
    prisma.expense.findMany({
      where: { orgId, date: { gte: from, lte: to } },
      select: { id: true, date: true, amount: true },
    }),
  ]);

  const availableAssets = assets.filter((a) => a.status === "available").length;
  const rentedAssets = assets.filter((a) => a.status === "rented").length;

  // Revenue / expense time series (by day for month range)
  const dailyRevenue = new Map<string, number>();
  const dailyExpense = new Map<string, number>();
  for (const r of rentalsThisPeriod) {
    const key = r.createdAt.toISOString().slice(0, 10);
    dailyRevenue.set(key, (dailyRevenue.get(key) ?? 0) + r.totalAmount.toNumber());
  }
  for (const e of expensesThisPeriod) {
    const key = e.date.toISOString().slice(0, 10);
    dailyExpense.set(key, (dailyExpense.get(key) ?? 0) + e.amount.toNumber());
  }

  const revenueSeries = [...dailyRevenue.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, value]) => ({ date, value }));
  const expenseSeries = [...dailyExpense.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, value]) => ({ date, value }));

  // Most rented assets
  const mostRented = await prisma.rental.groupBy({
    by: ["assetId"],
    where: { orgId, status: { not: "cancelled" } },
    _count: { _all: true },
    orderBy: { _count: { assetId: "desc" } },
    take: 5,
  });
  const assetNames = await prisma.asset.findMany({
    where: { id: { in: mostRented.map((r) => r.assetId) } },
    select: { id: true, name: true, assetNo: true },
  });
  const nameMap = new Map(assetNames.map((a) => [a.id, `${a.name} (${a.assetNo})`]));

  return {
    stats: {
      totalAssets: assets.length,
      availableAssets,
      rentedAssets,
      maintenanceAssets: assets.filter((a) => a.status === "maintenance").length,
      damagedAssets: assets.filter((a) => a.status === "damaged").length,
      reservedAssets: assets.filter((a) => a.status === "reserved").length,
      activeRentals,
      dueToday,
      overdueRentals,
      upcomingRentals,
      activeCustomers: customers,
      revenue: revenueAgg._sum.amount ?? toDecimal(0),
      expenses: expenseAgg._sum.amount ?? toDecimal(0),
      depositsHeld: depositsHeldAgg._sum.amount ?? toDecimal(0),
      outstanding: outstanding._sum.balance ?? toDecimal(0),
      openDamageCases: damageCount,
      maintenanceDue,
    },
    charts: {
      revenueSeries,
      expenseSeries,
      mostRented: mostRented.map((r) => ({ name: nameMap.get(r.assetId) ?? r.assetId, rentals: r._count._all })),
      fleetStatus: [
        { name: "Available", value: availableAssets, color: "#10b981" },
        { name: "Rented", value: rentedAssets, color: "#3b82f6" },
        { name: "Reserved", value: assets.filter((a) => a.status === "reserved").length, color: "#8b5cf6" },
        { name: "Maintenance", value: assets.filter((a) => a.status === "maintenance").length, color: "#f59e0b" },
        { name: "Damaged", value: assets.filter((a) => a.status === "damaged").length, color: "#ef4444" },
        { name: "Other", value: assets.filter((a) => !["available", "rented", "reserved", "maintenance", "damaged"].includes(a.status)).length, color: "#9ca3af" },
      ].filter((s) => s.value > 0),
    },
  };
}
