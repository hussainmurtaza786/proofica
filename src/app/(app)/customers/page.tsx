import type { Metadata } from "next";
import Link from "next/link";
import { differenceInCalendarDays } from "date-fns";
import { Users } from "lucide-react";

import { requireOrg } from "@/services/access";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { SearchBox } from "@/components/customers/search-box";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Customers" };

const VALID_STATUSES = ["active", "blocked", "archived"];

function ExpiryBadge({ expiry }: { expiry: Date }) {
  const daysLeft = differenceInCalendarDays(expiry, new Date());
  if (daysLeft < 0) {
    return (
      <Badge variant="outline" className="ml-1.5 border-red-500/30 bg-destructive/10 text-destructive">
        Expired
      </Badge>
    );
  }
  if (daysLeft <= 30) {
    return (
      <Badge variant="outline" className="ml-1.5 border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">
        Expiring
      </Badge>
    );
  }
  return null;
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireOrg();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const status =
    typeof params.status === "string" && VALID_STATUSES.includes(params.status) ? params.status : undefined;

  const where: Prisma.CustomerWhereInput = { orgId: ctx.orgId };
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { phone: { contains: q } },
      { email: { contains: q } },
    ];
  }
  if (status) where.status = status;

  const [customers, org] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: { _count: { select: { rentals: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.organization.findUnique({ where: { id: ctx.orgId } }),
  ]);
  const timezone = org?.timezone ?? "UTC";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Manage the people who rent from you."
        actions={
          <>
            <SearchBox defaultValue={q} status={status} />
            <Button asChild>
              <Link href="/customers/new">Add Customer</Link>
            </Button>
          </>
        }
      />

      {customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers yet"
          description="Add your first customer to start renting to them with proof."
          actionLabel="Add Customer"
          href="/customers/new"
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>License expiry</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rentals</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/customers/${c.id}`} className="block">
                      <span className="font-medium text-foreground hover:text-brand">{c.name}</span>
                      <span className="block text-xs text-muted-foreground">{c.customerNo}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-foreground/80">{c.phone}</TableCell>
                  <TableCell className="text-foreground/80">
                    {c.licenseExpiry ? (
                      <>
                        {fmtDate(c.licenseExpiry, timezone)}
                        <ExpiryBadge expiry={c.licenseExpiry} />
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} />
                  </TableCell>
                  <TableCell className="text-foreground/80">{c._count.rentals}</TableCell>
                  <TableCell>
                    <Link href={`/customers/${c.id}`} className="text-sm font-medium text-brand hover:underline">
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
