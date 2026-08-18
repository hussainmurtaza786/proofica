"use server";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { requireOrg } from "@/services/access";
import { prisma } from "@/lib/prisma";
import { fmtDateTime } from "@/lib/dates";
import type { InspectionReportData } from "@/components/pdf/inspection-report-document";
import type { RentalAgreementData } from "@/components/pdf/rental-agreement-document";

async function photoToDataUrl(url: string): Promise<string> {
  try {
    const key = url.replace(/^\/api\/files\//, "");
    const storageDir = process.env.STORAGE_LOCAL_DIR || "storage";
    const root = path.resolve(storageDir);
    const filePath = path.resolve(path.join(process.cwd(), storageDir, key));
    if (!filePath.startsWith(root)) return "";
    const buf = await readFile(filePath);
    const ext = path.extname(key).toLowerCase();
    const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return "";
  }
}

export async function getInspectionReportData(inspectionId: string): Promise<InspectionReportData> {
  const ctx = await requireOrg();

  const inspection = await prisma.inspection.findFirst({
    where: { id: inspectionId, orgId: ctx.orgId },
    include: {
      rental: { include: { customer: true, asset: { include: { category: true } } } },
      items: { orderBy: { sortOrder: "asc" } },
      damages: true,
      photos: true,
      signatures: true,
    },
  });

  if (!inspection) throw new Error("Inspection not found");

  const org = await prisma.organization.findUnique({
    where: { id: ctx.orgId },
    select: { name: true, address: true, phone: true, email: true, currency: true },
  });

  const paired = await prisma.inspection.findMany({
    where: { orgId: ctx.orgId, rentalId: inspection.rentalId },
    include: { photos: true },
  });

  const other = paired.find((p) => p.id !== inspection.id && p.type !== inspection.type);

  const photosWithUrls = await Promise.all(
    inspection.photos.map(async (p) => ({
      category: p.category ?? "other",
      url: await photoToDataUrl(p.url),
      caption: p.caption,
    }))
  );

  let comparison: InspectionReportData["comparison"] = null;
  if (other) {
    const beforeInspection = inspection.type === "handover" ? inspection : other;
    const afterInspection = inspection.type === "return" ? inspection : other;
    const beforePhotos = await Promise.all(
      beforeInspection.photos.map(async (p) => ({
        category: p.category ?? "other",
        url: await photoToDataUrl(p.url),
        caption: p.caption,
      }))
    );
    const afterPhotos = await Promise.all(
      afterInspection.photos.map(async (p) => ({
        category: p.category ?? "other",
        url: await photoToDataUrl(p.url),
        caption: p.caption,
      }))
    );
    comparison = { beforePhotos, afterPhotos };
  }

  return {
    org: org ?? { name: "Organization", currency: "USD" },
    inspection: {
      type: inspection.type,
      status: inspection.status,
      startedAt: fmtDateTime(inspection.startedAt),
      completedAt: inspection.completedAt ? fmtDateTime(inspection.completedAt) : null,
      mileage: inspection.mileage,
      engineHours: inspection.engineHours,
      fuelLevel: inspection.fuelLevel,
      oilLevel: inspection.oilLevel,
      notes: inspection.notes,
    },
    rental: {
      rentalNo: inspection.rental.rentalNo,
      customerName: inspection.rental.customer.name,
      assetName: inspection.rental.asset.name,
      assetNo: inspection.rental.asset.assetNo,
    },
    items: inspection.items.map((i) => ({
      section: i.section,
      label: i.label,
      status: i.status,
      beforeValue: i.beforeValue,
      afterValue: i.afterValue,
      notes: i.notes,
    })),
    damages: inspection.damages.map((d) => ({
      category: d.category,
      description: d.description,
      severity: d.severity,
      location: d.location,
      estimatedRepairCost: Number(d.estimatedRepairCost),
      isPreExisting: d.isPreExisting,
    })),
    photos: photosWithUrls,
    signatures: inspection.signatures.map((sig) => ({
      role: sig.role,
      name: sig.name,
      dataUrl: sig.dataUrl,
    })),
    comparison,
    generatedAt: new Date().toLocaleString(),
  };
}

export async function getRentalAgreementData(rentalId: string): Promise<RentalAgreementData> {
  const ctx = await requireOrg();

  const rental = await prisma.rental.findFirst({
    where: { id: rentalId, orgId: ctx.orgId },
    include: {
      customer: true,
      asset: { include: { category: true } },
      payments: { orderBy: { receivedAt: "desc" } },
      charges: { orderBy: { appliedAt: "desc" } },
      inspections: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!rental) throw new Error("Rental not found");

  const org = await prisma.organization.findUnique({
    where: { id: ctx.orgId },
    select: { name: true, address: true, phone: true, email: true, currency: true },
  });

  return {
    org: org ?? { name: "Organization", currency: "USD" },
    rental: {
      rentalNo: rental.rentalNo,
      status: rental.status,
      startAt: fmtDateTime(rental.startAt),
      expectedReturnAt: fmtDateTime(rental.expectedReturnAt),
      actualReturnAt: rental.actualReturnAt ? fmtDateTime(rental.actualReturnAt) : null,
      pricingModel: rental.pricingModel,
      rate: Number(rental.rate),
      quantity: rental.quantity,
      depositRequired: Number(rental.depositRequired),
      depositHeld: Number(rental.depositHeld),
      discount: Number(rental.discount),
      taxPercent: Number(rental.taxPercent),
      baseTotal: Number(rental.baseTotal),
      chargesTotal: Number(rental.chargesTotal),
      taxTotal: Number(rental.taxTotal),
      totalAmount: Number(rental.totalAmount),
      amountPaid: Number(rental.amountPaid),
      balance: Number(rental.balance),
      notes: rental.notes,
      createdAt: fmtDateTime(rental.createdAt),
      customer: {
        name: rental.customer.name,
        customerNo: rental.customer.customerNo,
        phone: rental.customer.phone,
        email: rental.customer.email,
        address: rental.customer.address,
        idType: rental.customer.idType,
        idNumber: rental.customer.idNumber,
        licenseNumber: rental.customer.licenseNumber,
      },
      asset: {
        name: rental.asset.name,
        assetNo: rental.asset.assetNo,
        registrationNumber: rental.asset.registrationNumber,
        brand: rental.asset.brand,
        model: rental.asset.model,
        year: rental.asset.year,
        color: rental.asset.color,
        category: rental.asset.category.name,
      },
      payments: rental.payments.map((p) => ({
        type: p.type,
        method: p.method,
        amount: Number(p.amount),
        receivedAt: fmtDateTime(p.receivedAt),
      })),
      charges: rental.charges.map((c) => ({
        type: c.type,
        description: c.description,
        amount: Number(c.amount),
        appliedAt: fmtDateTime(c.appliedAt),
      })),
      inspections: rental.inspections.map((i) => ({
        type: i.type,
        status: i.status,
        completedAt: i.completedAt ? fmtDateTime(i.completedAt) : null,
      })),
    },
    generatedAt: new Date().toLocaleString(),
  };
}
