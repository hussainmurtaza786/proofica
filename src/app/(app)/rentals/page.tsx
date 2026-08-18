import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, CalendarClock, Plus } from "lucide-react";

import { requireOrg } from "@/services/access";
import { prisma } from "@/lib/prisma";
import { RENTAL_STATUSES } from "@/lib/constants";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { MoneyDisplay } from "@/components/shared/money-display";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Rentals" };

export default async function RentalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireOrg();
  const params = await searchParams;
  const status = typeof params.status === "string" && RENTAL_STATUSES.includes(params.status as never) ? params.status : undefined;

  const [org, rentals] = await Promise.all([
    prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { currency: true } }),
    prisma.rental.findMany({
      where: { orgId: ctx.orgId, ...(status ? { status } : {}) },
      include: { customer: true, asset: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const currency = org?.currency ?? "PKR";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rentals"
        description="Reservations, active contracts, and history."
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/rentals/calendar">
                <CalendarDays className="mr-2 h-4 w-4" /> Calendar
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/rentals/overdue">
                <CalendarClock className="mr-2 h-4 w-4" /> Overdue
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/rentals/new">
                <Plus className="mr-2 h-4 w-4" /> New Rental
              </Link>
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap gap-1.5">
        <Link
          href="/rentals"
          className={cn(
            "rounded-full border px-3 py-1 text-sm font-medium transition",
            !status ? "border-brand/30 bg-brand/10 text-brand" : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          All
        </Link>
        {RENTAL_STATUSES.filter((s) => s !== "draft" && s !== "returned" && s !== "inspection_pending").map((s) => (
          <Link
            key={s}
            href={`/rentals?status=${s}`}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-medium transition",
              status === s ? "border-brand/30 bg-brand/10 text-brand" : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {s.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </Link>
        ))}
      </div>

      <Card className="shadow-none border-border">
        <div className="overflow-x-auto rounded-xl">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead>Rental</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Asset</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>Return</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rentals.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/60">
                  <TableCell>
                    <Link href={`/rentals/${r.id}`} className="font-medium text-brand hover:underline">
                      {r.rentalNo}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/customers/${r.customerId}`} className="text-foreground/80 hover:underline">
                      {r.customer.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/assets/${r.assetId}`} className="text-foreground/80 hover:underline">
                      {r.asset.name}
                      {r.quantity > 1 && <span className="ml-1 text-xs text-muted-foreground">× {r.quantity}</span>}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{fmtDateTime(r.startAt)}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{fmtDateTime(r.expectedReturnAt)}</TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <MoneyDisplay value={r.totalAmount} currency={currency} />
                  </TableCell>
                  <TableCell className="text-right">
                    {r.balance.greaterThan(0) ? (
                      <MoneyDisplay value={r.balance} currency={currency} negative />
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {rentals.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-16 text-center text-sm text-muted-foreground">
                    No rentals found. Create your first rental to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
