import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, ClipboardCheck, FileText, History } from "lucide-react";

import { requireOrg, can } from "@/services/access";
import { prisma } from "@/lib/prisma";
import { getOrgSettings } from "@/services/settings";
import { getRentalAgreementData } from "@/server/actions/pdf";
import { PERMISSIONS } from "@/lib/constants";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { MoneyDisplay } from "@/components/shared/money-display";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PdfDownloadButton } from "@/components/pdf/pdf-download-button";
import { fmtDateTime } from "@/lib/dates";
import { StartInspectionButton } from "@/components/rentals/start-inspection-button";
import { ShareButton } from "@/components/rentals/share-button";
import { PaymentForm } from "@/components/rentals/payment-form";
import { DepositPanel } from "@/components/rentals/deposit-panel";
import { ChargeForm } from "@/components/rentals/charge-form";
import { ExtensionForm } from "@/components/rentals/extension-form";
import { cancelRental, computeLateFeeNow } from "@/server/actions/rentals";

export const metadata: Metadata = { title: "Rental" };

export default async function RentalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireOrg();
  const { id } = await params;

  const [org, settings, rental, auditLogs] = await Promise.all([
    prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { currency: true } }),
    getOrgSettings(ctx.orgId),
    prisma.rental.findFirst({
      where: { id, orgId: ctx.orgId },
      include: {
        customer: true,
        asset: { include: { category: true } },
        payments: { include: { receivedByUser: { select: { name: true } } }, orderBy: { receivedAt: "desc" } },
        deposits: { include: { transactions: { orderBy: { createdAt: "desc" } } } },
        charges: { orderBy: { appliedAt: "desc" } },
        extensions: { orderBy: { createdAt: "desc" } },
        inspections: { include: { items: true, photos: true, signatures: true }, orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.auditLog.findMany({
      where: { orgId: ctx.orgId, entityType: "rental", entityId: id },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  if (!rental) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Rental not found.</p>;
  }

  let pdfData = null;
  try {
    pdfData = await getRentalAgreementData(id);
  } catch {
    // PDF generation may fail; page still renders
  }

  const currency = org?.currency ?? "PKR";
  const { displayCurrency, displayRate } = settings.currencySettings;
  const handover = rental.inspections.find((i) => i.type === "handover");
  const returnInspection = rental.inspections.find((i) => i.type === "return");
  const deposit = rental.deposits[0];
  const activeStatuses = ["reserved", "awaiting_handover", "active", "due_soon", "overdue"];

  let lateFee = null;
  if (["active", "due_soon", "overdue"].includes(rental.status)) {
    lateFee = await computeLateFeeNow({
      expectedReturnAt: rental.expectedReturnAt,
      actualReturnAt: new Date(),
      orgId: ctx.orgId,
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={rental.rentalNo}
        description={
          <span className="flex items-center gap-2">
            <StatusBadge status={rental.status} />
            <span className="text-muted-foreground">· created {fmtDateTime(rental.createdAt)}</span>
          </span>
        }
        actions={
          <>
            {can(ctx, PERMISSIONS.createRental) && handover?.status !== "completed" && activeStatuses.includes(rental.status) && (
              <StartInspectionButton rentalId={rental.id} type="handover" label={handover ? "Resume handover" : "Start handover"} />
            )}
            {can(ctx, PERMISSIONS.createRental) &&
              ["active", "due_soon", "overdue"].includes(rental.status) &&
              !returnInspection && <StartInspectionButton rentalId={rental.id} type="return" label="Start return" variant="outline" />}
            {can(ctx, PERMISSIONS.cancelRental) && activeStatuses.includes(rental.status) && (
              <form action={cancelRental.bind(null, { ok: false }) as unknown as (fd: FormData) => void}>
                <input type="hidden" name="id" value={rental.id} />
                <Button type="submit" variant="outline" size="sm">
                  Cancel
                </Button>
              </form>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href={`/rentals/${rental.id}/report`}>
                <FileText className="mr-2 h-4 w-4" /> Report
              </Link>
            </Button>
            {pdfData && <PdfDownloadButton type="rental" data={pdfData} label="Download PDF" />}
            <ShareButton rentalId={rental.id} />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Link href={`/customers/${rental.customerId}`} className="font-medium text-brand hover:underline">
              {rental.customer.name}
            </Link>
            <p className="text-muted-foreground">{rental.customer.customerNo}</p>
            <p className="text-muted-foreground">{rental.customer.phone}</p>
          </CardContent>
        </Card>

        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Asset</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Link href={`/assets/${rental.assetId}`} className="font-medium text-brand hover:underline">
              {rental.asset.name}
            </Link>
            <p className="text-muted-foreground">
              {rental.asset.assetNo} · {rental.asset.category.name}
            </p>
            {rental.quantity > 1 && (
              <p className="text-sm font-medium text-foreground">{rental.quantity} × {rental.asset.name}</p>
            )}
            <p className="flex items-center gap-1 text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              {fmtDateTime(rental.startAt)} → {fmtDateTime(rental.expectedReturnAt)}
            </p>
            {rental.actualReturnAt && <p className="text-muted-foreground">Returned {fmtDateTime(rental.actualReturnAt)}</p>}
          </CardContent>
        </Card>

        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Pricing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Rate
              </span>
              <span className="font-medium text-foreground">
                <MoneyDisplay value={rental.rate} currency={currency} displayCurrency={displayCurrency} displayRate={displayRate} />
                <span className="ml-1 text-xs font-normal text-muted-foreground">/ {rental.pricingModel}{rental.quantity > 1 ? ` × ${rental.quantity}` : ""}</span>
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Base</span>
              <MoneyDisplay value={rental.baseTotal} currency={currency} displayCurrency={displayCurrency} displayRate={displayRate} />
            </div>
            {!rental.chargesTotal.isZero() && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Charges</span>
                <MoneyDisplay value={rental.chargesTotal} currency={currency} displayCurrency={displayCurrency} displayRate={displayRate} />
              </div>
            )}
            {!rental.discount.isZero() && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <MoneyDisplay value={rental.discount} currency={currency} displayCurrency={displayCurrency} displayRate={displayRate} negative />
              </div>
            )}
            {!rental.taxTotal.isZero() && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <MoneyDisplay value={rental.taxTotal} currency={currency} displayCurrency={displayCurrency} displayRate={displayRate} />
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-2 font-semibold text-foreground">
              <span>Total</span>
              <MoneyDisplay value={rental.totalAmount} currency={currency} displayCurrency={displayCurrency} displayRate={displayRate} />
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Paid</span>
              <MoneyDisplay value={rental.amountPaid} currency={currency} displayCurrency={displayCurrency} displayRate={displayRate} />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Balance</span>
              {rental.balance.greaterThan(0) ? (
                <MoneyDisplay value={rental.balance} currency={currency} displayCurrency={displayCurrency} displayRate={displayRate} negative />
              ) : (
                <span className="text-muted-foreground">Paid in full</span>
              )}
            </div>
            {lateFee && lateFee.fee.greaterThan(0) && (
              <p className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-400">
                Estimated late fee: <MoneyDisplay value={lateFee.fee} currency={currency} displayCurrency={displayCurrency} displayRate={displayRate} /> ({lateFee.overdueMinutes} min overdue)
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-foreground">
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" /> Inspections
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {rental.inspections.length === 0 && <p className="text-sm text-muted-foreground">No inspections yet.</p>}
            {rental.inspections.map((i) => (
              <Link
                key={i.id}
                href={`/inspections/${i.id}`}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 transition hover:border-border hover:bg-muted/50"
              >
                <div>
                  <p className="text-sm font-medium text-foreground capitalize">{i.type} inspection</p>
                  <p className="text-xs text-muted-foreground">
                    {i.status === "completed"
                      ? `Completed ${fmtDateTime(i.completedAt)}`
                      : `Started ${fmtDateTime(i.startedAt)}`}
                    {" · "}
                    {i.items.length} items · {i.photos.length} photos
                  </p>
                </div>
                <StatusBadge status={i.status} />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-none border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base text-foreground">Payments</CardTitle>
            {can(ctx, PERMISSIONS.recordPayment) && <PaymentForm rentalId={rental.id} />}
          </CardHeader>
          <CardContent className="space-y-3">
            {deposit && (
              <DepositPanel
                deposit={{
                  id: deposit.id,
                  amount: deposit.amount.toString(),
                  status: deposit.status,
                  heldAt: deposit.heldAt,
                  returnedAt: deposit.returnedAt,
                }}
                transactions={deposit.transactions.map((t) => ({
                  id: t.id,
                  type: t.type,
                  amount: t.amount.toString(),
                  reason: t.reason,
                  createdAt: t.createdAt,
                }))}
                currency={currency}
              />
            )}
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted">
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rental.payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{fmtDateTime(p.receivedAt)}</TableCell>
                      <TableCell className="text-sm capitalize text-foreground">{p.type}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.method.replaceAll("_", " ")}</TableCell>
                      <TableCell className="text-right">
                        <MoneyDisplay value={p.amount} currency={currency} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {rental.payments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                        No payments recorded.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-none border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base text-foreground">Charges & Extensions</CardTitle>
          <div className="flex items-center gap-2">
            {can(ctx, PERMISSIONS.manageRentals) && ["active", "due_soon", "overdue"].includes(rental.status) && (
              <ExtensionForm
                rentalId={rental.id}
                currentReturnAt={rental.expectedReturnAt.toISOString()}
                minAt={rental.expectedReturnAt.toISOString().slice(0, 16)}
              />
            )}
            {can(ctx, PERMISSIONS.manageRentals) && <ChargeForm rentalId={rental.id} />}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rental.charges.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm capitalize text-foreground">{c.type}</TableCell>
                    <TableCell className="text-sm text-foreground/80">{c.description}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{fmtDateTime(c.appliedAt)}</TableCell>
                    <TableCell className="text-right">
                      <MoneyDisplay value={c.amount} currency={currency} />
                    </TableCell>
                  </TableRow>
                ))}
                {rental.charges.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                      No charges.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {rental.extensions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Extensions</p>
              {rental.extensions.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="text-foreground/80">
                    {fmtDateTime(e.fromAt)} → {fmtDateTime(e.toAt)}
                  </span>
                  <MoneyDisplay value={e.additionalCost} currency={currency} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-none border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-foreground">
            <History className="h-4 w-4 text-muted-foreground" /> Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {auditLogs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
              <p className="text-foreground/80">
                <span className="font-medium text-foreground">{log.user.name}</span> {log.description}
              </p>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">{fmtDateTime(log.createdAt)}</span>
            </div>
          ))}
          {auditLogs.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
