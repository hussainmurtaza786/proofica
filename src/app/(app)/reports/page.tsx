import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";

import { requireOrg } from "@/services/access";
import { prisma } from "@/lib/prisma";
import { money } from "@/lib/decimal";
import { Prisma } from "@prisma/client";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { MoneyDisplay } from "@/components/shared/money-display";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/constants";

export const metadata: Metadata = { title: "Reports" };

const PERIODS = [
  { value: "month", label: "This month" },
  { value: "last", label: "Last month" },
  { value: "year", label: "This year" },
  { value: "all", label: "All time" },
] as const;

function periodRange(period: string): { from?: Date; to?: Date } {
  const now = new Date();
  if (period === "month") {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
  }
  if (period === "last") {
    return {
      from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      to: new Date(now.getFullYear(), now.getMonth(), 1),
    };
  }
  if (period === "year") {
    return { from: new Date(now.getFullYear(), 0, 1), to: now };
  }
  return {};
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const ctx = await requireOrg();
  const { period: raw } = await searchParams;
  const period = PERIODS.some((p) => p.value === raw) ? raw! : "month";
  const range = periodRange(period);
  const between: Prisma.DateTimeFilter | undefined = range.from && range.to ? { gte: range.from, lte: range.to } : undefined;

  const [org, revenueAgg, expenseAgg, byAsset, byCategory, byCustomer, topRentals] = await Promise.all([
    prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { currency: true } }),
    prisma.payment.aggregate({
      where: { orgId: ctx.orgId, type: { notIn: ["deposit", "refund"] }, ...(between ? { receivedAt: between } : {}) },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.expense.aggregate({
      where: { orgId: ctx.orgId, ...(between ? { date: between } : {}) },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.payment.groupBy({
      by: ["rentalId"],
      where: { orgId: ctx.orgId, type: { notIn: ["deposit", "refund"] }, ...(between ? { receivedAt: between } : {}) },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 10,
    }),
    prisma.expense.groupBy({
      by: ["category"],
      where: { orgId: ctx.orgId, ...(between ? { date: between } : {}) },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
    }),
    prisma.payment.groupBy({
      by: ["customerId"],
      where: { orgId: ctx.orgId, type: { notIn: ["deposit", "refund"] }, ...(between ? { receivedAt: between } : {}) },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 8,
    }),
    prisma.rental.findMany({
      where: { orgId: ctx.orgId, ...(between ? { createdAt: between } : {}), status: { not: "cancelled" } },
      orderBy: { totalAmount: "desc" },
      take: 8,
      select: {
        id: true,
        rentalNo: true,
        totalAmount: true,
        customer: { select: { name: true } },
        asset: { select: { name: true } },
      },
    }),
  ]);

  const currency = org?.currency ?? "PKR";
  const revenue = revenueAgg._sum?.amount ?? money.zero();
  const expenses = expenseAgg._sum?.amount ?? money.zero();
  const net = money.sub(revenue, expenses);

  const assetNames = await prisma.asset.findMany({
    where: { orgId: ctx.orgId },
    select: { id: true, name: true },
  });
  const assetNameMap = new Map(assetNames.map((a) => [a.id, a.name]));
  const customerIds = byCustomer.map((c) => c.customerId).filter((id): id is string => !!id);
  const customerNames = await prisma.customer.findMany({
    where: { id: { in: customerIds }, orgId: ctx.orgId },
    select: { id: true, name: true },
  });
  const customerNameMap = new Map(customerNames.map((c) => [c.id, c.name]));

  const rentalCount = await prisma.rental.count({
    where: { orgId: ctx.orgId, ...(between ? { createdAt: between } : {}), status: { not: "cancelled" } },
  });
  const avgRentalValue = rentalCount > 0 ? revenue.dividedBy(rentalCount) : money.zero();

  const params = period === "all" ? "" : `&period=${period}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Revenue, expenses and performance."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
              {PERIODS.map((p) => (
                <Link
                  key={p.value}
                  href={`/reports?period=${p.value}`}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    period === p.value ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.label}
                </Link>
              ))}
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/reports/export?type=revenue${params}`}>
                <Download className="mr-2 h-4 w-4" /> CSV
              </a>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue" value={<MoneyDisplay value={revenue} currency={currency} />} hint={`${revenueAgg._count} payment(s)`} />
        <StatCard label="Expenses" value={<MoneyDisplay value={expenses} currency={currency} />} hint={`${expenseAgg._count} expense(s)`} />
        <StatCard label="Net" value={<MoneyDisplay value={net} currency={currency} />} tone={net.lessThan(0) ? "danger" : "default"} />
        <StatCard label="Avg rental value" value={<MoneyDisplay value={avgRentalValue} currency={currency} />} hint={`${rentalCount} rental(s)`} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Revenue by asset</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {byAsset.map((row) => (
              <div key={row.rentalId} className="flex items-center justify-between text-sm">
                <span className="truncate text-foreground/80">{assetNameMap.get(row.rentalId) ?? "Unknown asset"}</span>
                <MoneyDisplay value={row._sum?.amount} currency={currency} />
              </div>
            ))}
            {byAsset.length === 0 && <p className="text-sm text-muted-foreground">No revenue in this period.</p>}
          </CardContent>
        </Card>

        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Expenses by category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {byCategory.map((row) => (
              <div key={row.category} className="flex items-center justify-between text-sm">
                <span className="truncate text-foreground/80">{EXPENSE_CATEGORY_LABELS[row.category] ?? row.category}</span>
                <MoneyDisplay value={row._sum?.amount} currency={currency} />
              </div>
            ))}
            {byCategory.length === 0 && <p className="text-sm text-muted-foreground">No expenses in this period.</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Top customers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {byCustomer.map((row) => (
              <div key={row.customerId} className="flex items-center justify-between text-sm">
                <span className="truncate text-foreground/80">{row.customerId ? (customerNameMap.get(row.customerId) ?? "Unknown") : "Unknown"}</span>
                <MoneyDisplay value={row._sum?.amount} currency={currency} />
              </div>
            ))}
            {byCustomer.length === 0 && <p className="text-sm text-muted-foreground">No revenue in this period.</p>}
          </CardContent>
        </Card>

        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Largest rentals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topRentals.map((r) => (
              <Link key={r.id} href={`/rentals/${r.id}`} className="flex items-center justify-between text-sm hover:underline">
                <span className="truncate text-foreground/80">
                  {r.rentalNo} · {r.asset.name} · {r.customer.name}
                </span>
                <MoneyDisplay value={r.totalAmount} currency={currency} />
              </Link>
            ))}
            {topRentals.length === 0 && <p className="text-sm text-muted-foreground">No rentals in this period.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
