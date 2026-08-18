import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireOrg } from "@/services/access";
import { prisma } from "@/lib/prisma";
import { getOrgSettings } from "@/services/settings";
import { startInspection } from "@/server/actions/inspections";
import { StatusBadge } from "@/components/shared/status-badge";
import { InspectionWizard } from "@/components/inspections/inspection-wizard";

export const metadata: Metadata = { title: "Inspection" };

export default async function InspectionWizardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; type: "handover" | "return" }>;
  searchParams: Promise<{ inspectionId?: string }>;
}) {
  const ctx = await requireOrg();
  const { id: rentalId, type } = await params;
  const { inspectionId } = await searchParams;

  const rental = await prisma.rental.findFirst({
    where: { id: rentalId, orgId: ctx.orgId },
    include: { asset: { include: { category: true } }, customer: true },
  });
  if (!rental) return <p className="py-16 text-center text-sm text-muted-foreground">Rental not found.</p>;

  let inspection = inspectionId
    ? await prisma.inspection.findFirst({ where: { id: inspectionId, orgId: ctx.orgId } })
    : null;
  if (!inspection) {
    const res = await startInspection(rentalId, type);
    if (!res.ok || !res.id) return <p className="py-16 text-center text-sm text-muted-foreground">{res.error ?? "Could not start inspection"}</p>;
    inspection = await prisma.inspection.findUnique({ where: { id: res.id } });
  }

  if (!inspection) return <p className="py-16 text-center text-sm text-muted-foreground">Inspection not found.</p>;

  const [items, damages, photos, signatures, settings] = await Promise.all([
    prisma.inspectionItem.findMany({ where: { inspectionId: inspection.id }, orderBy: { sortOrder: "asc" } }),
    prisma.damage.findMany({ where: { inspectionId: inspection.id } }),
    prisma.inspectionPhoto.findMany({ where: { inspectionId: inspection.id } }),
    prisma.signature.findMany({ where: { inspectionId: inspection.id } }),
    getOrgSettings(ctx.orgId),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ButtonBack href={`/rentals/${rentalId}`} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {type === "handover" ? "Handover" : "Return"} inspection
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            {rental.rentalNo} · {rental.customer.name} · {rental.asset.name}
            <StatusBadge status={inspection.status} />
          </p>
        </div>
      </div>

      <InspectionWizard
        inspectionId={inspection.id}
        rentalId={rental.id}
        type={type}
        asset={{
          mileage: rental.asset.mileage,
          engineHours: rental.asset.engineHours,
          fuelLevel: rental.asset.fuelLevel,
        }}
        items={items.map((i) => ({
          id: i.id,
          label: i.label,
          section: i.section,
          category: i.category ?? undefined,
          beforeValue: i.beforeValue ?? undefined,
          afterValue: i.afterValue ?? undefined,
          status: i.status,
          notes: i.notes ?? undefined,
          sortOrder: i.sortOrder,
        }))}
        damages={damages.map((d) => ({
          id: d.id,
          category: d.category,
          location: d.location ?? "",
          description: d.description,
          severity: d.severity,
          estimatedRepairCost: Number(d.estimatedRepairCost),
          isPreExisting: d.isPreExisting,
        }))}
        photos={photos.map((p) => ({ url: p.url, category: p.category ?? "other" }))}
        signatures={signatures.map((s) => ({ role: s.role as "customer" | "staff", name: s.name, dataUrl: s.dataUrl }))}
        settings={{
          requiredPhotoCategories: settings.inspectionSettings.requiredPhotoCategories,
          requireCustomerSignature: settings.inspectionSettings.requireCustomerSignature,
        }}
      />
    </div>
  );
}

function ButtonBack({ href }: { href: string }) {
  return (
    <Link href={href} className="rounded-lg border border-border bg-card p-2 text-muted-foreground transition hover:text-foreground">
      <ArrowLeft className="h-4 w-4" />
    </Link>
  );
}
