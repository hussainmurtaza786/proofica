import type { Metadata } from "next";
import Link from "next/link";

import { requireOrg } from "@/services/access";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: "Inspections" };

const FILTERS = ["all", "in_progress", "completed"] as const;

export default async function InspectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const ctx = await requireOrg();
  const { status } = await searchParams;
  const filter = FILTERS.includes(status as (typeof FILTERS)[number]) ? (status as (typeof FILTERS)[number]) : "all";

  const inspections = await prisma.inspection.findMany({
    where: { orgId: ctx.orgId, ...(filter !== "all" ? { status: filter } : {}) },
    include: {
      rental: { include: { customer: true, asset: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Inspections" description="All handover and return inspections across your fleet." />

      <div className="flex items-center gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/inspections" : `/inspections?status=${f}`}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
              filter === f ? "border-brand bg-brand text-brand-foreground" : "border-border bg-card text-muted-foreground hover:border-border"
            }`}
          >
            {f.replace("_", " ")}
          </Link>
        ))}
      </div>

      <Card className="shadow-none border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead>Type</TableHead>
                  <TableHead>Rental</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Asset</TableHead>
                  <TableHead>Performed by</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inspections.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>
                      <Link href={`/inspections/${i.id}`} className="font-medium capitalize text-brand hover:underline">
                        {i.type}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-foreground/80">{i.rental.rentalNo}</TableCell>
                    <TableCell className="text-sm text-foreground/80">{i.rental.customer.name}</TableCell>
                    <TableCell className="text-sm text-foreground/80">{i.rental.asset.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{i.performedBy}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{fmtDateTime(i.startedAt)}</TableCell>
                    <TableCell>
                      <StatusBadge status={i.status} />
                    </TableCell>
                  </TableRow>
                ))}
                {inspections.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                      No inspections found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
