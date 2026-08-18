import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { requireOrg, can } from "@/services/access";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/constants";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { MoneyDisplay } from "@/components/shared/money-display";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StartInspectionButton } from "@/components/rentals/start-inspection-button";
import { computeLateFeeNow } from "@/server/actions/rentals";
import { fmtDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: "Overdue rentals" };

export default async function OverduePage() {
  const ctx = await requireOrg();

  const [org, rentals] = await Promise.all([
    prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { currency: true } }),
    prisma.rental.findMany({
      where: { orgId: ctx.orgId, status: { in: ["overdue", "due_soon"] } },
      include: { customer: true, asset: true },
      orderBy: [{ status: "asc" }, { expectedReturnAt: "asc" }],
    }),
  ]);

  const currency = org?.currency ?? "PKR";
  const now = new Date();

  const withLate = await Promise.all(
    rentals.map(async (r) => {
      const late = await computeLateFeeNow({ expectedReturnAt: r.expectedReturnAt, actualReturnAt: now, orgId: ctx.orgId });
      const minutes = Math.max(0, Math.floor((now.getTime() - r.expectedReturnAt.getTime()) / 60000));
      return { rental: r, late, minutes };
    })
  );

  const overdue = withLate.filter((x) => x.rental.status === "overdue");
  const dueSoon = withLate.filter((x) => x.rental.status === "due_soon");

  return (
    <div className="space-y-6">
      <PageHeader title="Overdue rentals" description="Rentals past their return time and those due soon." />

      {overdue.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive ring-1 ring-destructive/20">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {overdue.length} rental(s) are currently overdue.
        </div>
      )}

      <Card className="shadow-none border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead>Rental</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Asset</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Late fee (est.)</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {withLate.map(({ rental: r, late, minutes }) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link href={`/rentals/${r.id}`} className="font-medium text-brand hover:underline">
                        {r.rentalNo}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-foreground/80">{r.customer.name}</TableCell>
                    <TableCell className="text-sm text-foreground/80">{r.asset.name}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {fmtDateTime(r.expectedReturnAt)}
                      {minutes > 0 && <span className="ml-2 rounded bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">{minutes} min late</span>}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <MoneyDisplay value={late.fee} currency={currency} />
                    </TableCell>
                    <TableCell className="text-right">
                      {r.balance.greaterThan(0) ? <MoneyDisplay value={r.balance} currency={currency} negative /> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      {can(ctx, PERMISSIONS.createRental) && !r.actualReturnAt && (
                        <StartInspectionButton rentalId={r.id} type="return" label="Start return" variant="outline" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {withLate.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                      Nothing overdue. Nice.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {dueSoon.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {dueSoon.length} rental(s) due soon — they will move to overdue after their expected return time.
        </p>
      )}
    </div>
  );
}
