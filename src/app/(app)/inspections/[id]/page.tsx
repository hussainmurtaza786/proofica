import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Camera } from "lucide-react";

import { requireOrg } from "@/services/access";
import { prisma } from "@/lib/prisma";
import { getInspectionReportData } from "@/server/actions/pdf";
import { StatusBadge } from "@/components/shared/status-badge";
import { MoneyDisplay } from "@/components/shared/money-display";
import { BeforeAfterViewer } from "@/components/shared/before-after-viewer";
import { DamageBodyMap } from "@/components/inspections/damage-body-map";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PdfDownloadButton } from "@/components/pdf/pdf-download-button";
import { fmtDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: "Inspection" };

export default async function InspectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrg();
  const { id } = await params;

  const [inspection, org, paired] = await Promise.all([
    prisma.inspection.findFirst({
      where: { id, orgId: ctx.orgId },
      include: {
        rental: { include: { customer: true, asset: { include: { category: true } } } },
        items: { orderBy: { sortOrder: "asc" } },
        damages: true,
        photos: true,
        signatures: true,
      },
    }),
    prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { currency: true } }),
    prisma.inspection.findMany({
      where: { orgId: ctx.orgId, rentalId: (await prisma.inspection.findFirst({ where: { id, orgId: ctx.orgId } }))?.rentalId ?? "" },
      include: { photos: true },
    }),
  ]);

  if (!inspection) return <p className="py-16 text-center text-sm text-muted-foreground">Inspection not found.</p>;

  let pdfData = null;
  try {
    pdfData = await getInspectionReportData(id);
  } catch {
    // PDF generation may fail if photos are missing; page still renders
  }

  const currency = org?.currency ?? "PKR";
  const other = paired.find((p) => p.id !== inspection.id && p.type !== inspection.type);
  const before = inspection.type === "handover" ? inspection : other;
  const after = inspection.type === "return" ? inspection : other;

  const meter = (label: string) => inspection.items.find((i) => i.section === "meter" && i.label === label);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/rentals/${inspection.rentalId}`} className="rounded-lg border border-border bg-card p-2 text-muted-foreground transition hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight text-foreground">
            {inspection.type} inspection
            <StatusBadge status={inspection.status} />
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {inspection.rental.rentalNo} · {inspection.rental.customer.name} · {inspection.rental.asset.name}
          </p>
        </div>
        {pdfData && <PdfDownloadButton type="inspection" data={pdfData} />}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Meters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <MeterRow label="Mileage" value={meter("Mileage")?.afterValue ?? meter("Mileage")?.beforeValue ?? (inspection.mileage != null ? String(inspection.mileage) : null)} />
            <MeterRow label="Engine hours" value={meter("Engine hours")?.afterValue ?? meter("Engine hours")?.beforeValue ?? (inspection.engineHours != null ? String(inspection.engineHours) : null)} />
            <MeterRow label="Fuel level" value={meter("Fuel level")?.afterValue ?? meter("Fuel level")?.beforeValue ?? (inspection.fuelLevel != null ? `${inspection.fuelLevel}%` : null)} />
            {inspection.oilLevel && <MeterRow label="Oil level" value={inspection.oilLevel} />}
            {inspection.notes && <p className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{inspection.notes}</p>}
          </CardContent>
        </Card>

        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <p className="text-muted-foreground">Started {fmtDateTime(inspection.startedAt)}</p>
            {inspection.completedAt && <p className="text-muted-foreground">Completed {fmtDateTime(inspection.completedAt)}</p>}
            <p className="text-muted-foreground">{inspection.items.length} checklist items</p>
            <p className="text-muted-foreground">{inspection.photos.length} photos</p>
            <p className="text-muted-foreground">{inspection.signatures.length} signature(s)</p>
          </CardContent>
        </Card>

        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Damages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {inspection.damages.map((d) => (
              <div key={d.id} className="rounded-lg border border-border px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium capitalize text-foreground">{d.category}</p>
                  <span className="text-xs capitalize text-muted-foreground">
                    {d.severity} · {d.isPreExisting ? "pre-existing" : "new"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{d.description}</p>
                {d.location && <p className="text-xs text-muted-foreground">{d.location}</p>}
                {!d.estimatedRepairCost.isZero() && (
                  <p className="mt-1 text-sm text-foreground/80">
                    Est. cost: <MoneyDisplay value={d.estimatedRepairCost} currency={currency} />
                  </p>
                )}
              </div>
            ))}
            {inspection.damages.length === 0 && <p className="text-sm text-muted-foreground">No damages recorded.</p>}
          </CardContent>
        </Card>
      </div>

      {inspection.damages.length > 0 && (
        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Damage Locations</CardTitle>
          </CardHeader>
          <CardContent>
            <DamageBodyMap
              kind={inspection.rental.asset.category.kind}
              damages={inspection.damages.map((d) => ({
                id: d.id,
                x: d.positionX ?? 50,
                y: d.positionY ?? 50,
                category: d.category,
                severity: d.severity,
                description: d.description,
                isPreExisting: d.isPreExisting,
              }))}
            />
          </CardContent>
        </Card>
      )}

      {before && after && (
        <Card className="shadow-none border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base text-foreground">
              <Camera className="h-4 w-4 text-muted-foreground" /> Before / after
            </CardTitle>
            <span className="text-xs text-muted-foreground">Drag the slider to compare</span>
          </CardHeader>
          <CardContent className="space-y-4">
            {["front", "rear", "left", "right", "interior", "dashboard", "engine", "tires", "damage", "other"].map((cat) => {
              const beforePhoto = before.photos.find((p) => p.category === cat);
              const afterPhoto = after.photos.find((p) => p.category === cat);
              if (!beforePhoto || !afterPhoto) return null;
              return (
                <div key={cat}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{cat}</p>
                  <BeforeAfterViewer beforeUrl={beforePhoto.url} afterUrl={afterPhoto.url} />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {inspection.items.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-4 border-b border-border pb-2.5 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{i.label}</p>
                  {i.notes && <p className="truncate text-xs text-muted-foreground">{i.notes}</p>}
                </div>
                <ItemStatusBadge status={i.status} value={i.afterValue ?? i.beforeValue} />
              </div>
            ))}
            {inspection.items.length === 0 && <p className="text-sm text-muted-foreground">No checklist items.</p>}
          </CardContent>
        </Card>

        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Signatures</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {inspection.signatures.map((s) => (
              <div key={s.id} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium capitalize text-foreground">{s.role}</p>
                <p className="text-xs text-muted-foreground">{s.name}</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.dataUrl} alt={s.role} className="mt-2 h-16 w-full rounded-md bg-white object-contain ring-1 ring-border" />
              </div>
            ))}
            {inspection.signatures.length === 0 && <p className="text-sm text-muted-foreground">No signatures.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MeterRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value ?? "—"}</span>
    </div>
  );
}

function ItemStatusBadge({ status, value }: { status: string; value?: string | null }) {
  const tone =
    status === "ok"
      ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-400"
      : status === "issue"
        ? "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-400"
        : status === "missing"
          ? "bg-destructive/10 text-destructive ring-destructive/20"
          : "bg-muted text-muted-foreground ring-border";
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ${tone}`}>
      {value || status}
    </span>
  );
}
