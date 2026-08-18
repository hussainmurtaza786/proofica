import type { Metadata } from "next";
import Link from "next/link";
import { ImageIcon, Package, ClipboardCheck, TrendingUp } from "lucide-react";

import { requireOrg } from "@/services/access";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { MoneyDisplay } from "@/components/shared/money-display";
import { StatusChange } from "@/components/assets/status-change";
import { DamageBodyMap } from "@/components/inspections/damage-body-map";
import { retireAsset } from "@/server/actions/assets";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { MAINTENANCE_TYPE_LABELS } from "@/lib/constants";
import { parseCustomFields, parseCustomFieldValues, formatCustomFieldValue } from "@/lib/custom-fields";

export const metadata: Metadata = { title: "Asset" };

const NEAR_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

function isNearExpiry(date: Date | null): boolean {
  if (!date) return false;
  const diff = date.getTime() - Date.now();
  return diff > 0 && diff < NEAR_EXPIRY_MS;
}

function Info({
  label,
  children,
  highlight,
  className,
}: {
  label: string;
  children?: React.ReactNode;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 text-sm whitespace-pre-wrap",
          highlight ? "font-medium text-amber-600 dark:text-amber-400" : "text-foreground/80"
        )}
      >
        {children ?? "—"}
      </dd>
    </div>
  );
}

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireOrg();
  const { id } = await params;

  const asset = await prisma.asset.findFirst({
    where: { id, orgId: ctx.orgId },
    include: {
      category: true,
      photos: true,
      documents: true,
      maintenance: { orderBy: { date: "desc" } },
      rentals: {
        include: {
          customer: true,
          payments: { select: { amount: true } },
          charges: { select: { amount: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      inspections: {
        include: { damages: true, photos: true, rental: { select: { rentalNo: true, customer: { select: { name: true } } } } },
        orderBy: { completedAt: "asc" },
      },
    },
  });

  if (!asset) {
    return (
      <div className="space-y-6">
        <PageHeader title="Asset" description="Not found" />
        <EmptyState
          icon={Package}
          title="Asset not found"
          description="This asset may have been removed or you may not have access to it."
          actionLabel="Back to Assets"
          href="/assets"
        />
      </div>
    );
  }

  const customDefs = parseCustomFields(asset.category.customFieldsJson);
  const customValues = parseCustomFieldValues(asset.customFieldsJson);
  const customPairs = customDefs
    .map((def) => ({ def, value: formatCustomFieldValue(def, customValues[def.key]) }))
    .filter((p) => p.value !== "—");

  // Lifecycle metrics
  const now = new Date();
  const allRentals = await prisma.rental.findMany({
    where: { assetId: asset.id },
    select: { startAt: true, actualReturnAt: true, expectedReturnAt: true, status: true, totalAmount: true },
  });

  const totalRevenue = allRentals.reduce((sum, r) => sum + Number(r.totalAmount), 0);
  const totalMaintenanceCost = asset.maintenance.reduce((sum, m) => sum + Number(m.cost), 0);
  const totalDamageCost = asset.inspections.reduce(
    (sum, insp) => sum + insp.damages.reduce((dSum, d) => dSum + Number(d.estimatedRepairCost), 0),
    0
  );
  const netProfit = totalRevenue - totalMaintenanceCost - totalDamageCost;

  const purchaseDate = asset.purchaseDate ?? asset.createdAt;
  const totalDaysSincePurchase = Math.max(1, Math.floor((now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24)));
  const rentedDays = allRentals.reduce((sum, r) => {
    const start = r.startAt.getTime();
    const end = r.actualReturnAt?.getTime() ?? (r.status === "completed" ? start : now.getTime());
    return sum + Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
  }, 0);
  const utilizationRate = Math.min(100, Math.round((rentedDays / totalDaysSincePurchase) * 100));
  const roi = asset.purchasePrice && Number(asset.purchasePrice) > 0
    ? Math.round(((netProfit / Number(asset.purchasePrice)) * 100))
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={asset.name}
        description={`${asset.assetNo} · ${asset.category.name} · ${fmtDate(asset.createdAt)}`}
        actions={
          <>
            <form action={retireAsset.bind(null, { ok: false }) as unknown as (fd: FormData) => void}>
              <input type="hidden" name="id" value={asset.id} />
              <Button type="submit" variant="outline">
                Retire
              </Button>
            </form>
            <StatusChange id={asset.id} status={asset.status} />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Specs</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Info label="Brand">{asset.brand}</Info>
              <Info label="Model">{asset.model}</Info>
              <Info label="Year">{asset.year}</Info>
              <Info label="Color">{asset.color}</Info>
              <Info label="Registration">{asset.registrationNumber}</Info>
              <Info label="VIN">{asset.vin}</Info>
              <Info label="Engine No.">{asset.engineNumber}</Info>
              <Info label="Serial No.">{asset.serialNumber}</Info>
            </dl>
          </CardContent>
        </Card>

        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Meters</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Info label="Mileage">
                {asset.mileage != null ? `${asset.mileage.toLocaleString()} km` : null}
              </Info>
              <Info label="Engine Hours">
                {asset.engineHours != null ? `${asset.engineHours} h` : null}
              </Info>
              <Info label="Fuel Level">
                {asset.fuelLevel != null ? `${asset.fuelLevel}%` : null}
              </Info>
              <Info label="Oil Level">{asset.oilLevel}</Info>
            </dl>
          </CardContent>
        </Card>

        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Financials</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Info label="Purchase Price">
                {asset.purchasePrice != null ? <MoneyDisplay value={asset.purchasePrice} /> : null}
              </Info>
              <Info label="Current Value">
                {asset.currentValue != null ? <MoneyDisplay value={asset.currentValue} /> : null}
              </Info>
              <Info label="Purchase Date">{fmtDate(asset.purchaseDate)}</Info>
              <Info label="Insurance Expiry" highlight={isNearExpiry(asset.insuranceExpiry)}>
                {fmtDate(asset.insuranceExpiry)}
              </Info>
              <Info label="Registration Expiry" highlight={isNearExpiry(asset.registrationExpiry)}>
                {fmtDate(asset.registrationExpiry)}
              </Info>
              <Info label="Inspection Expiry" highlight={isNearExpiry(asset.inspectionExpiry)}>
                {fmtDate(asset.inspectionExpiry)}
              </Info>
            </dl>
          </CardContent>
        </Card>

        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Info label="Location">{asset.location}</Info>
              <Info label="Status">
                <StatusBadge status={asset.status} />
              </Info>
              <Info label="Description" className="sm:col-span-2">
                {asset.description}
              </Info>
              <Info label="Notes" className="sm:col-span-2">
                {asset.notes}
              </Info>
            </dl>
          </CardContent>
        </Card>

        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-foreground">
              <TrendingUp className="h-4 w-4 text-muted-foreground" /> Lifecycle
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Info label="Total Rentals">{allRentals.length}</Info>
              <Info label="Utilization Rate">
                <span className={cn(
                  "font-medium",
                  utilizationRate >= 70 ? "text-emerald-600 dark:text-emerald-400" :
                  utilizationRate >= 40 ? "text-amber-600 dark:text-amber-400" :
                  "text-red-600 dark:text-red-400"
                )}>
                  {utilizationRate}%
                </span>
                <span className="ml-1 text-xs text-muted-foreground">({rentedDays} of {totalDaysSincePurchase} days)</span>
              </Info>
              <Info label="Total Revenue">
                <MoneyDisplay value={totalRevenue} />
              </Info>
              <Info label="Maintenance Costs">
                <MoneyDisplay value={totalMaintenanceCost} />
              </Info>
              <Info label="Damage Costs">
                <MoneyDisplay value={totalDamageCost} />
              </Info>
              <Info label="Net Profit">
                <span className={cn(
                  "font-medium",
                  netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                )}>
                  <MoneyDisplay value={netProfit} />
                </span>
              </Info>
              {roi !== null && (
                <Info label="ROI">
                  <span className={cn(
                    "font-medium",
                    roi >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                  )}>
                    {roi > 0 ? "+" : ""}{roi}%
                  </span>
                </Info>
              )}
            </dl>
          </CardContent>
        </Card>

        {customPairs.length > 0 && (
          <Card className="shadow-none border-border">
            <CardHeader>
              <CardTitle className="text-base text-foreground">{asset.category.name} details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {customPairs.map(({ def, value }) => (
                  <Info key={def.key} label={def.label}>
                    {value}
                  </Info>
                ))}
              </dl>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="shadow-none border-border">
        <CardHeader>
          <CardTitle className="text-base text-foreground">Photos</CardTitle>
        </CardHeader>
        <CardContent>
          {asset.photos.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {asset.photos.map((p) => (
                <a
                  key={p.id}
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-lg border border-border"
                >
                  <img
                    src={p.url}
                    alt={p.caption ?? asset.name}
                    className="aspect-square w-full object-cover"
                  />
                </a>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={ImageIcon}
              title="No photos uploaded yet"
              description="Photos captured during handover or return inspections will appear here."
            />
          )}
        </CardContent>
      </Card>

      {asset.inspections.length > 0 && (
        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-foreground">
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" /> Inspection Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative ml-3 border-l-2 border-border pl-6">
              {asset.inspections.map((insp) => {
                const damageCount = insp.damages.length;
                const photoCount = insp.photos.length;
                const totalRepairCost = insp.damages.reduce((sum, d) => sum + Number(d.estimatedRepairCost), 0);
                return (
                  <div key={insp.id} className="relative mb-8 last:mb-0">
                    <div className={cn(
                      "absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full border-2 border-card",
                      insp.type === "handover" ? "bg-emerald-500" : "bg-blue-500"
                    )} />
                    <Link href={`/inspections/${insp.id}`} className="group block">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-foreground group-hover:text-brand">
                            {insp.type === "handover" ? "Handover" : "Return"} inspection
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {insp.rental.rentalNo} · {insp.rental.customer.name}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {insp.completedAt ? fmtDateTime(insp.completedAt) : fmtDateTime(insp.startedAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {damageCount > 0 && (
                            <span className={cn(
                              "rounded-full px-2 py-0.5 font-medium",
                              insp.damages.some((d) => !d.isPreExisting)
                                ? "bg-amber-500/10 text-amber-700"
                                : "bg-muted text-muted-foreground"
                            )}>
                              {damageCount} damage{damageCount > 1 ? "s" : ""}
                            </span>
                          )}
                          {photoCount > 0 && <span>{photoCount} photos</span>}
                          {totalRepairCost > 0 && (
                            <span className="font-medium text-foreground">
                              <MoneyDisplay value={totalRepairCost} />
                            </span>
                          )}
                          <StatusBadge status={insp.status} />
                        </div>
                      </div>
                    </Link>
                    {damageCount > 0 && (
                      <div className="mt-3">
                        <DamageBodyMap
                          kind={asset.category.kind}
                          damages={insp.damages.map((d) => ({
                            id: d.id,
                            x: d.positionX ?? 50,
                            y: d.positionY ?? 50,
                            category: d.category,
                            severity: d.severity,
                            description: d.description,
                            isPreExisting: d.isPreExisting,
                          }))}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-none border-border">
        <CardHeader>
          <CardTitle className="text-base text-foreground">Maintenance History</CardTitle>
        </CardHeader>
        <CardContent>
          {asset.maintenance.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No maintenance records yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Vendor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {asset.maintenance.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-foreground/80">{fmtDate(m.date)}</TableCell>
                    <TableCell className="text-foreground">
                      {MAINTENANCE_TYPE_LABELS[m.type] ?? m.type}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={m.status} />
                    </TableCell>
                    <TableCell>
                      <MoneyDisplay value={m.cost} />
                    </TableCell>
                    <TableCell className="text-foreground/80">{m.vendor || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-none border-border">
        <CardHeader>
          <CardTitle className="text-base text-foreground">Rental History</CardTitle>
        </CardHeader>
        <CardContent>
          {asset.rentals.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No rentals yet for this asset.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rental</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>Expected Return</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {asset.rentals.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link href={`/rentals/${r.id}`} className="font-medium text-brand hover:underline">
                        {r.rentalNo}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/customers/${r.customer.id}`}
                        className="text-foreground/80 hover:text-brand hover:underline"
                      >
                        {r.customer.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-foreground/80">{fmtDateTime(r.startAt)}</TableCell>
                    <TableCell className="text-foreground/80">{fmtDateTime(r.expectedReturnAt)}</TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell>
                      <MoneyDisplay value={r.totalAmount} />
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
