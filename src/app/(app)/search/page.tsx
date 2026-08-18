import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";

import { requireOrg } from "@/services/access";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireOrg();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";

  if (!q) {
    return (
      <div className="space-y-6">
        <PageHeader title="Search" description="Search customers, assets and rentals." />
        <EmptyState icon={Search} title="Type something to search" />
      </div>
    );
  }

  const [customers, assets, rentals] = await Promise.all([
    prisma.customer.findMany({
      where: {
        orgId: ctx.orgId,
        OR: [
          { name: { contains: q } },
          { phone: { contains: q } },
          { email: { contains: q } },
        ],
      },
      select: { id: true, customerNo: true, name: true, phone: true },
      take: 10,
    }),
    prisma.asset.findMany({
      where: {
        orgId: ctx.orgId,
        OR: [
          { name: { contains: q } },
          { assetNo: { contains: q } },
          { registrationNumber: { contains: q } },
        ],
      },
      select: { id: true, assetNo: true, name: true, categoryId: true, status: true },
      take: 10,
    }),
    prisma.rental.findMany({
      where: { orgId: ctx.orgId, rentalNo: { contains: q } },
      select: {
        id: true,
        rentalNo: true,
        status: true,
        totalAmount: true,
        customer: { select: { name: true } },
        asset: { select: { name: true } },
      },
      take: 10,
    }),
  ]);

  const hasResults = customers.length > 0 || assets.length > 0 || rentals.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Search" description={`Results for "${q}"`} />

      {!hasResults ? (
        <EmptyState icon={Search} title="No results for your search" />
      ) : (
        <>
          {customers.length > 0 && (
            <Card className="shadow-none border-border">
              <CardHeader>
                <CardTitle className="text-base text-foreground">Customers</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Customer No</TableHead>
                      <TableHead>Phone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <Link href={`/customers/${c.id}`} className="font-medium text-foreground hover:text-brand">
                            {c.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{c.customerNo}</TableCell>
                        <TableCell className="text-muted-foreground">{c.phone}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {assets.length > 0 && (
            <Card className="shadow-none border-border">
              <CardHeader>
                <CardTitle className="text-base text-foreground">Assets</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Asset No</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assets.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <Link href={`/assets/${a.id}`} className="font-medium text-foreground hover:text-brand">
                            {a.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{a.assetNo}</TableCell>
                        <TableCell>
                          <StatusBadge status={a.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {rentals.length > 0 && (
            <Card className="shadow-none border-border">
              <CardHeader>
                <CardTitle className="text-base text-foreground">Rentals</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rental No</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Asset</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rentals.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Link href={`/rentals/${r.id}`} className="font-medium text-foreground hover:text-brand">
                            {r.rentalNo}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{r.customer.name}</TableCell>
                        <TableCell className="text-muted-foreground">{r.asset.name}</TableCell>
                        <TableCell>
                          <StatusBadge status={r.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
