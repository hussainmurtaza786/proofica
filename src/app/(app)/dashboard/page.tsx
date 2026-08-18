import type { Metadata } from "next";
import Link from "next/link";
import {
  Banknote,
  CalendarClock,
  CircleDollarSign,
  Package,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  AlertTriangle,
  CarFront,
  ShieldAlert,
  Wrench,
} from "lucide-react";

import { requireOrg } from "@/services/access";
import { prisma } from "@/lib/prisma";
import { getDashboardData, type DateRange } from "@/services/dashboard";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { MoneyDisplay } from "@/components/shared/money-display";
import { RangePicker } from "@/components/dashboard/range-picker";
import { RevenueChart, MostRentedChart, FleetStatusChart } from "@/components/dashboard/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: "Dashboard" };

const VALID_RANGES: DateRange[] = ["today", "week", "month", "lastMonth", "year"];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireOrg();
  const params = await searchParams;
  const range = VALID_RANGES.includes(params.range as DateRange) ? (params.range as DateRange) : "month";

  const [data, dueAndOverdue, upcoming, recentActivity, org] = await Promise.all([
    getDashboardData(ctx.orgId, range),
    prisma.rental.findMany({
      where: { orgId: ctx.orgId, status: { in: ["active", "due_soon", "overdue"] } },
      include: { customer: true, asset: true },
      orderBy: { expectedReturnAt: "asc" },
      take: 8,
    }),
    prisma.rental.findMany({
      where: { orgId: ctx.orgId, status: { in: ["reserved", "awaiting_handover"] }, startAt: { gte: new Date() } },
      include: { customer: true, asset: true },
      orderBy: { startAt: "asc" },
      take: 5,
    }),
    prisma.auditLog.findMany({
      where: { orgId: ctx.orgId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.organization.findUnique({ where: { id: ctx.orgId } }),
  ]);

  const currency = org?.currency ?? "PKR";

  // Merge revenue + expense series into a single array for the area chart.
  const seriesMap = new Map<string, { date: string; value: number; expense: number }>();
  for (const r of data.charts.revenueSeries) {
    const entry = seriesMap.get(r.date) ?? { date: r.date, value: 0, expense: 0 };
    entry.value = r.value;
    seriesMap.set(r.date, entry);
  }
  for (const e of data.charts.expenseSeries) {
    const entry = seriesMap.get(e.date) ?? { date: e.date, value: 0, expense: 0 };
    entry.expense = e.value;
    seriesMap.set(e.date, entry);
  }
  const series = [...seriesMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  const stats = data.stats;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="A live view of your rental operation."
        actions={<RangePicker active={range} />}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Revenue"
          value={<MoneyDisplay value={stats.revenue} currency={currency} />}
          icon={TrendingUp}
          tone="success"
          hint="Non-deposit payments this period"
        />
        <StatCard
          label="Expenses"
          value={<MoneyDisplay value={stats.expenses} currency={currency} />}
          icon={TrendingDown}
          tone="warning"
          hint="This period"
        />
        <StatCard
          label="Active Rentals"
          value={stats.activeRentals}
          icon={CalendarClock}
          hint={`${stats.dueToday} due today`}
        />
        <StatCard
          label="Overdue"
          value={stats.overdueRentals}
          icon={AlertTriangle}
          tone="danger"
          hint="Immediate attention needed"
        />
        <StatCard
          label="Assets"
          value={stats.totalAssets}
          icon={CarFront}
          hint={`${stats.availableAssets} available · ${stats.rentedAssets} rented`}
        />
        <StatCard
          label="Active Customers"
          value={stats.activeCustomers}
          icon={Users}
        />
        <StatCard
          label="Deposits Held"
          value={<MoneyDisplay value={stats.depositsHeld} currency={currency} />}
          icon={Wallet}
          hint="Customer deposits in your possession"
        />
        <StatCard
          label="Outstanding Balance"
          value={<MoneyDisplay value={stats.outstanding} currency={currency} />}
          icon={Banknote}
          tone={stats.outstanding.greaterThan(0) ? "danger" : "default"}
          hint="Unpaid rental balances"
        />
        <StatCard
          label="Open Damage Cases"
          value={stats.openDamageCases}
          icon={ShieldAlert}
          tone={stats.openDamageCases > 0 ? "warning" : "default"}
          hint="Reported damages under review"
        />
        <StatCard
          label="Maintenance Due"
          value={stats.maintenanceDue}
          icon={Wrench}
          tone={stats.maintenanceDue > 0 ? "warning" : "default"}
          hint="Scheduled or overdue maintenance"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2 shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Revenue vs Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            {series.length > 0 ? (
              <RevenueChart data={series} />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">No activity in this period.</p>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Fleet Status</CardTitle>
          </CardHeader>
          <CardContent>
            {data.charts.fleetStatus.length > 0 ? (
              <FleetStatusChart data={data.charts.fleetStatus} />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">No assets yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Most Rented Assets</CardTitle>
          </CardHeader>
          <CardContent>
            {data.charts.mostRented.length > 0 ? (
              <MostRentedChart data={data.charts.mostRented} />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">No rental history yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base text-foreground">Rentals in Progress</CardTitle>
            <Link href="/rentals" className="text-sm font-medium text-brand hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {dueAndOverdue.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No active rentals right now.</p>
            )}
            {dueAndOverdue.map((r) => (
              <Link
                key={r.id}
                href={`/rentals/${r.id}`}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 transition hover:border-border hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {r.asset.name} · {r.customer.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{r.rentalNo}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="hidden text-xs text-muted-foreground sm:block">{fmtDateTime(r.expectedReturnAt)}</span>
                  <StatusBadge status={r.status} />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-none border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base text-foreground">Upcoming Rentals</CardTitle>
            <Link href="/rentals" className="text-sm font-medium text-brand hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">Nothing scheduled.</p>
            )}
            {upcoming.map((r) => (
              <Link
                key={r.id}
                href={`/rentals/${r.id}`}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 transition hover:border-border hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {r.asset.name} · {r.customer.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{fmtDateTime(r.startAt)}</p>
                </div>
                <StatusBadge status={r.status} />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-none border-border">
        <CardHeader>
          <CardTitle className="text-base text-foreground">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentActivity.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No activity yet.</p>}
          {recentActivity.map((log) => (
            <div key={log.id} className="flex items-start gap-3 text-sm">
              <CircleDollarSign className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
              <div className="min-w-0 flex-1">
                <p className="text-foreground/80">
                  <span className="font-medium text-foreground">{log.user.name}</span> {log.description}
                </p>
                <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <Package className="h-3 w-3" /> {fmtDateTime(log.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
