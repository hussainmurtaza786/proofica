import Link from "next/link";
import { Banknote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/shared/page-header";
import { MoneyDisplay } from "@/components/shared/money-display";
import { PaymentFilterBar } from "@/components/payments/filter-bar";
import { StatCard } from "@/components/shared/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtDateTime } from "@/lib/dates";
import { sumDecimal } from "@/lib/decimal";
import { PAYMENT_METHODS, PAYMENT_TYPES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/services/access";
import type { Prisma } from "@prisma/client";

export const metadata = { title: "Payments" };

function cap(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireOrg();
  const params = await searchParams;
  const typeParam = typeof params.type === "string" ? params.type : undefined;
  const methodParam = typeof params.method === "string" ? params.method : undefined;

  const where: Prisma.PaymentWhereInput = { orgId: ctx.orgId };
  if (typeParam && (PAYMENT_TYPES as readonly string[]).includes(typeParam)) where.type = typeParam;
  if (methodParam && (PAYMENT_METHODS as readonly string[]).includes(methodParam)) where.method = methodParam;

  const [payments, org] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        rental: { include: { asset: true, customer: true } },
        receivedByUser: { select: { name: true } },
      },
      orderBy: { receivedAt: "desc" },
      take: 200,
    }),
    prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { currency: true } }),
  ]);

  const currency = org?.currency ?? "PKR";
  const totalReceived = sumDecimal(
    payments.filter((p) => p.type !== "refund").map((p) => p.amount)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Every payment recorded, immutably."
        actions={<PaymentFilterBar type={typeParam} method={methodParam} />}
      />

      <StatCard
        label="Total Received"
        value={<MoneyDisplay value={totalReceived} currency={currency} />}
        icon={Banknote}
        hint="Sum of non-refund payments shown"
      />

      <Card className="shadow-none border-border">
        <CardContent className="p-0">
          {payments.length === 0 ? (
            <EmptyState
              title="No payments yet"
              description="Record a payment from a rental to see it here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ref</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Rental</TableHead>
                  <TableHead>Asset</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Received by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {p.reference ?? p.id.slice(0, 8)}
                    </TableCell>
                    <TableCell>{fmtDateTime(p.receivedAt)}</TableCell>
                    <TableCell>
                      <Link
                        href={`/rentals/${p.rental.id}`}
                        className="font-medium text-brand hover:underline"
                      >
                        {p.rental.rentalNo}
                      </Link>
                    </TableCell>
                    <TableCell>{p.rental.asset.name}</TableCell>
                    <TableCell>{p.rental.customer.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-medium">
                        {cap(p.type)}
                      </Badge>
                    </TableCell>
                    <TableCell>{cap(p.method)}</TableCell>
                    <TableCell className="text-right">
                      <MoneyDisplay
                        value={p.amount}
                        currency={currency}
                        negative={p.type === "refund"}
                      />
                    </TableCell>
                    <TableCell>{p.receivedByUser.name}</TableCell>
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
