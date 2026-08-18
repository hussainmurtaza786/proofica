import type { Metadata } from "next";
import Link from "next/link";
import { differenceInCalendarDays } from "date-fns";
import { FileText, Users } from "lucide-react";

import { requireOrg } from "@/services/access";
import { prisma } from "@/lib/prisma";
import { archiveCustomer } from "@/server/actions/customers";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { MoneyDisplay } from "@/components/shared/money-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Customer" };

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

function Info({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm whitespace-pre-wrap text-foreground/80">{children ?? "—"}</dd>
    </div>
  );
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireOrg();

  const [customer, org] = await Promise.all([
    prisma.customer.findFirst({
      where: { id, orgId: ctx.orgId },
      include: {
        rentals: { include: { asset: true }, orderBy: { createdAt: "desc" } },
        documents: true,
      },
    }),
    prisma.organization.findUnique({ where: { id: ctx.orgId } }),
  ]);

  if (!customer) {
    return (
      <div className="space-y-6">
        <PageHeader title="Customer" description="Not found" />
        <EmptyState
          icon={Users}
          title="Customer not found"
          description="This customer may have been removed or you may not have access to them."
          actionLabel="Back to Customers"
          href="/customers"
        />
      </div>
    );
  }

  const timezone = org?.timezone ?? "UTC";
  const currency = org?.currency ?? "PKR";

  return (
    <div className="space-y-6">
      <PageHeader
        title={customer.name}
        description={`${customer.customerNo} · since ${fmtDate(customer.createdAt, timezone)}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/customers/${id}/edit`}>Edit</Link>
            </Button>
            <form action={archiveCustomer.bind(null, { ok: false }) as unknown as (fd: FormData) => void}>
              <input type="hidden" name="id" value={customer.id} />
              <Button type="submit" variant="outline">
                Archive
              </Button>
            </form>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Contact</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-4">
              <Info label="Phone">{customer.phone}</Info>
              <Info label="Email">{customer.email}</Info>
              <Info label="Address">{customer.address}</Info>
              <Info label="City">{customer.city}</Info>
              <Info label="Country">{customer.country}</Info>
            </dl>
          </CardContent>
        </Card>

        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Identification</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-4">
              <Info label="ID type">{customer.idType}</Info>
              <Info label="ID number">{customer.idNumber}</Info>
              <Info label="ID expiry">
                {customer.idExpiry ? (
                  <>
                    {fmtDate(customer.idExpiry, timezone)}
                    <ExpiryBadge expiry={customer.idExpiry} />
                  </>
                ) : null}
              </Info>
              <Info label="License number">{customer.licenseNumber}</Info>
              <Info label="License expiry">
                {customer.licenseExpiry ? (
                  <>
                    {fmtDate(customer.licenseExpiry, timezone)}
                    <ExpiryBadge expiry={customer.licenseExpiry} />
                  </>
                ) : null}
              </Info>
            </dl>
          </CardContent>
        </Card>

        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Emergency Contact</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-4">
              <Info label="Name">{customer.emergencyContactName}</Info>
              <Info label="Phone">{customer.emergencyContactPhone}</Info>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-none border-border">
        <CardHeader>
          <CardTitle className="text-base text-foreground">Rental History</CardTitle>
        </CardHeader>
        <CardContent>
          {customer.rentals.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No rentals yet"
              description="Rentals for this customer will appear here once they start renting."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rental</TableHead>
                    <TableHead>Asset</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>Expected Return</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.rentals.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link href={`/rentals/${r.id}`} className="font-medium text-brand hover:underline">
                          {r.rentalNo}
                        </Link>
                      </TableCell>
                      <TableCell className="text-foreground/80">{r.asset.name}</TableCell>
                      <TableCell className="text-foreground/80">{fmtDate(r.startAt, timezone)}</TableCell>
                      <TableCell className="text-foreground/80">{fmtDate(r.expectedReturnAt, timezone)}</TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell>
                        <MoneyDisplay value={r.totalAmount} currency={currency} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-none border-border">
        <CardHeader>
          <CardTitle className="text-base text-foreground">Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {customer.documents.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No documents"
              description="Uploaded documents such as IDs and insurance will appear here."
            />
          ) : (
            <div className="divide-y divide-border">
              {customer.documents.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{d.name}</p>
                    <p className="text-xs text-muted-foreground">{d.type}</p>
                  </div>
                  <span className="shrink-0 text-sm text-muted-foreground">{fmtDate(d.expiresAt, timezone)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
