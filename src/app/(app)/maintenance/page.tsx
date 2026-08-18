import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/shared/page-header";
import { MaintenanceForm } from "@/components/maintenance/maintenance-form";
import { MoneyDisplay } from "@/components/shared/money-display";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatusFilter } from "@/components/maintenance/status-filter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtDate } from "@/lib/dates";
import { MAINTENANCE_TYPE_LABELS } from "@/lib/constants";
import { completeMaintenance } from "@/server/actions/expenses";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/services/access";
import type { Prisma } from "@prisma/client";

export const metadata = { title: "Maintenance" };

const MAINTENANCE_STATUSES = ["scheduled", "in_progress", "completed", "overdue"];

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireOrg();
  const params = await searchParams;
  const statusParam = typeof params.status === "string" ? params.status : undefined;
  const status = statusParam && MAINTENANCE_STATUSES.includes(statusParam) ? statusParam : undefined;

  const where: Prisma.MaintenanceWhereInput = { orgId: ctx.orgId };
  if (status) where.status = status;

  const [records, org, assets] = await Promise.all([
    prisma.maintenance.findMany({
      where,
      include: { asset: true },
      orderBy: { date: "desc" },
      take: 200,
    }),
    prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { currency: true } }),
    prisma.asset.findMany({
      where: { orgId: ctx.orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const currency = org?.currency ?? "PKR";
  const assetOptions = assets.map((a) => ({ value: a.id, label: a.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance"
        description="Track upkeep and schedules."
        actions={
          <div className="flex items-center gap-2">
            <StatusFilter status={status} />
            <MaintenanceForm assets={assetOptions} />
          </div>
        }
      />

      <Card className="shadow-none border-border">
        <CardContent className="p-0">
          {records.length === 0 ? (
            <EmptyState
              title="No maintenance records"
              description="Schedule your first maintenance job to keep assets running."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Asset</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Next due</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{fmtDate(m.date)}</TableCell>
                    <TableCell>
                      <Link
                        href={`/assets/${m.asset.id}`}
                        className="font-medium text-brand hover:underline"
                      >
                        {m.asset.name}
                      </Link>
                    </TableCell>
                    <TableCell>{MAINTENANCE_TYPE_LABELS[m.type] ?? m.type}</TableCell>
                    <TableCell>
                      <StatusBadge status={m.status} />
                    </TableCell>
                    <TableCell>{fmtDate(m.nextDate)}</TableCell>
                    <TableCell className="text-right">
                      <MoneyDisplay value={m.cost} currency={currency} />
                    </TableCell>
                    <TableCell>{m.vendor ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {m.status !== "completed" && (
                        <form action={completeMaintenance.bind(null, { ok: false }) as unknown as (fd: FormData) => void}>
                          <input type="hidden" name="id" value={m.id} />
                          <Button type="submit" variant="outline" size="sm">
                            Complete
                          </Button>
                        </form>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
