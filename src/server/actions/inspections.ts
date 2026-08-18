"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireOrg } from "@/services/access";
import {
  inspectionMeterSchema,
  inspectionItemSchema,
  inspectionDamageSchema,
  inspectionSignatureSchema,
  inspectionCompleteSchema,
} from "@/lib/validators";
import { PERMISSIONS } from "@/lib/constants";
import { toDecimal, money } from "@/lib/decimal";
import { audit } from "@/services/audit";
import { notify } from "@/services/notify";
import { getOrgSettings } from "@/services/settings";
import { computeLateFee, computeFuelCharge, computeDepositRefund } from "@/lib/rental-math";
import type { ActionResult } from "@/lib/actions";

// ------------------------------------------------------------
// Default checklist templates per asset kind
// ------------------------------------------------------------

const FUNCTIONAL_TESTS: Record<string, string[]> = {
  vehicle: ["AC", "Headlights", "Taillights", "Horn", "Brakes", "Wipers", "Radio", "Windows", "Power steering"],
  generator: ["Starts on first attempt", "Voltage output", "Frequency", "Auto cutoff", "Power sockets", "Emergency stop"],
  default: ["Power on", "Primary function", "Safety controls"],
};

const ACCESSORY_ITEMS: Record<string, string[]> = {
  vehicle: ["Spare tire", "Jack", "Documents", "Tool kit", "First aid kit", "Remote key", "Charging cable"],
  generator: ["Cables", "Plugs", "Manual", "Fuel can", "Tools", "Carrying handle"],
  default: ["Documents", "Manual", "Accessories"],
};

export async function startInspection(rentalId: string, type: "handover" | "return"): Promise<{ ok: boolean; error?: string; id?: string }> {
  const ctx = await requireOrg();

  const rental = await prisma.rental.findFirst({
    where: { id: rentalId, orgId: ctx.orgId },
    include: { asset: { include: { category: true } } },
  });
  if (!rental) return { ok: false, error: "Rental not found" };

  const existing = await prisma.inspection.findUnique({
    where: { rentalId_type: { rentalId, type } },
  });

  if (existing) return { ok: true, id: existing.id };

  const kind = rental.asset.category.kind;
  const functionalTests = FUNCTIONAL_TESTS[kind] ?? FUNCTIONAL_TESTS.default;
  const accessories = ACCESSORY_ITEMS[kind] ?? ACCESSORY_ITEMS.default;

  const inspection = await prisma.$transaction(async (tx) => {
    const created = await tx.inspection.create({
      data: {
        orgId: ctx.orgId,
        rentalId,
        assetId: rental.assetId,
        type,
        status: "in_progress",
        performedBy: ctx.userId,
      },
    });

    let sort = 0;
    const items: {
      orgId: string;
      inspectionId: string;
      section: string;
      label: string;
      category?: string;
      sortOrder: number;
      beforeValue?: string;
      afterValue?: string;
    }[] = [];

    for (const test of functionalTests) {
      items.push({ orgId: ctx.orgId, inspectionId: created.id, section: "functional", label: test, category: "functional", sortOrder: sort++ });
    }
    for (const item of accessories) {
      items.push({ orgId: ctx.orgId, inspectionId: created.id, section: "accessory", label: item, category: "accessory", sortOrder: sort++ });
    }

    // Meter defaults from the asset's current readings.
    if (rental.asset.mileage != null) {
      items.push({ orgId: ctx.orgId, inspectionId: created.id, section: "meter", label: "Mileage", category: "meter", sortOrder: sort++, beforeValue: String(rental.asset.mileage) });
    }
    if (rental.asset.engineHours != null) {
      items.push({ orgId: ctx.orgId, inspectionId: created.id, section: "meter", label: "Engine hours", category: "meter", sortOrder: sort++, beforeValue: String(rental.asset.engineHours) });
    }
    if (rental.asset.fuelLevel != null) {
      items.push({ orgId: ctx.orgId, inspectionId: created.id, section: "meter", label: "Fuel level", category: "meter", sortOrder: sort++, beforeValue: `${rental.asset.fuelLevel}%` });
    }

    if (items.length > 0) {
      await tx.inspectionItem.createMany({ data: items });
    }

    return created;
  });

  if (type === "handover") {
    await prisma.rental.update({ where: { id: rentalId }, data: { status: "awaiting_handover" } });
  }

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: "inspection",
    entityType: "inspection",
    entityId: inspection.id,
    description: `Started ${type} inspection on ${rental.rentalNo}`,
  });

  return { ok: true, id: inspection.id };
}

export async function saveMeterReadings(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  const parsed = inspectionMeterSchema.safeParse({
    inspectionId: formData.get("inspectionId"),
    mileage: formData.get("mileage"),
    engineHours: formData.get("engineHours"),
    fuelLevel: formData.get("fuelLevel"),
    oilLevel: formData.get("oilLevel"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const inspection = await prisma.inspection.findFirst({ where: { id: data.inspectionId, orgId: ctx.orgId } });
  if (!inspection) return { ok: false, error: "Inspection not found" };

  await prisma.inspection.update({
    where: { id: inspection.id },
    data: {
      mileage: data.mileage ?? null,
      engineHours: data.engineHours ?? null,
      fuelLevel: data.fuelLevel ?? null,
      oilLevel: data.oilLevel || null,
      notes: data.notes || null,
    },
  });

  // Sync meter readings into inspection items so before/after comparison works.
  const setItem = async (label: string, section: string, value: string | null, target: "beforeValue" | "afterValue") => {
    if (!value) return;
    const existing = await prisma.inspectionItem.findFirst({
      where: { inspectionId: inspection.id, section, label },
    });
    if (existing) {
      await prisma.inspectionItem.update({ where: { id: existing.id }, data: { [target]: value } });
    } else {
      await prisma.inspectionItem.create({
        data: {
          orgId: ctx.orgId,
          inspectionId: inspection.id,
          section,
          label,
          category: "meter",
          [target]: value,
          sortOrder: 0,
        },
      });
    }
  };

  const target: "beforeValue" | "afterValue" = inspection.type === "handover" ? "beforeValue" : "afterValue";
  await setItem("Mileage", "meter", data.mileage != null ? String(data.mileage) : null, target);
  await setItem("Engine hours", "meter", data.engineHours != null ? String(data.engineHours) : null, target);
  await setItem("Fuel level", "meter", data.fuelLevel != null ? `${data.fuelLevel}%` : null, target);

  return { ok: true, message: "Meter readings saved" };
}

export async function saveInspectionItems(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  const parsed = inspectionItemSchema.safeParse({
    inspectionId: formData.get("inspectionId"),
    items: (() => { try { return JSON.parse(String(formData.get("items") ?? "[]")); } catch { return []; } })(),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid items" };
  const data = parsed.data;

  const inspection = await prisma.inspection.findFirst({ where: { id: data.inspectionId, orgId: ctx.orgId } });
  if (!inspection) return { ok: false, error: "Inspection not found" };

  const target = inspection.type === "handover" ? "beforeValue" : "afterValue";

  await prisma.$transaction(async (tx) => {
    for (const item of data.items) {
      const value = item.afterValue || item.beforeValue || item.status;
      if (item.id) {
        await tx.inspectionItem.update({
          where: { id: item.id },
          data: {
            [target]: value,
            status: item.status,
            notes: item.notes || null,
            afterValue: item.afterValue || null,
            beforeValue: item.beforeValue || null,
          },
        });
      } else {
        await tx.inspectionItem.create({
          data: {
            orgId: ctx.orgId,
            inspectionId: inspection.id,
            section: item.section,
            label: item.label,
            category: item.category,
            [target]: value,
            status: item.status,
            notes: item.notes || null,
            sortOrder: item.sortOrder,
          },
        });
      }
    }
  });

  return { ok: true, message: "Checklist saved" };
}

export async function saveDamages(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  const parsed = inspectionDamageSchema.safeParse({
    inspectionId: formData.get("inspectionId"),
    damages: (() => { try { return JSON.parse(String(formData.get("damages") ?? "[]")); } catch { return []; } })(),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid damage data" };
  const data = parsed.data;

  const inspection = await prisma.inspection.findFirst({
    where: { id: data.inspectionId, orgId: ctx.orgId },
    include: { rental: true },
  });
  if (!inspection) return { ok: false, error: "Inspection not found" };

  await prisma.$transaction(async (tx) => {
    for (const d of data.damages) {
      if (d.id) {
        await tx.damage.update({
          where: { id: d.id },
          data: {
            category: d.category,
            location: d.location || null,
            description: d.description,
            severity: d.severity,
            estimatedRepairCost: toDecimal(d.estimatedRepairCost),
            positionX: d.positionX ?? null,
            positionY: d.positionY ?? null,
          },
        });
      } else {
        await tx.damage.create({
          data: {
            orgId: ctx.orgId,
            rentalId: inspection.rentalId,
            assetId: inspection.assetId,
            inspectionId: inspection.id,
            category: d.category,
            location: d.location || null,
            description: d.description,
            severity: d.severity,
            estimatedRepairCost: toDecimal(d.estimatedRepairCost),
            positionX: d.positionX ?? null,
            positionY: d.positionY ?? null,
            isPreExisting: inspection.type === "handover" ? true : d.isPreExisting,
            reportedBy: ctx.userId,
          },
        });
      }
    }
  });

  if (inspection.type === "return") {
    const newDamageCount = data.damages.filter((d) => !d.isPreExisting).length;
    if (newDamageCount > 0) {
      await notify({
        orgId: ctx.orgId,
        type: "damage_detected",
        title: "New damage detected",
        body: `${newDamageCount} new damage item(s) recorded on ${inspection.rental.rentalNo}.`,
        link: `/rentals/${inspection.rentalId}`,
      });
    }
  }

  return { ok: true, message: "Damage record saved" };
}

export async function saveInspectionPhoto(
  inspectionId: string,
  url: string,
  key: string,
  category: string,
  caption?: string,
  positionX?: number,
  positionY?: number
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireOrg();
  const inspection = await prisma.inspection.findFirst({
    where: { id: inspectionId, orgId: ctx.orgId },
  });
  if (!inspection) return { ok: false, error: "Inspection not found" };

  await prisma.inspectionPhoto.create({
    data: {
      orgId: ctx.orgId,
      inspectionId,
      rentalId: inspection.rentalId,
      assetId: inspection.assetId,
      category,
      url,
      fileKey: key,
      caption: caption || null,
      positionX: positionX ?? null,
      positionY: positionY ?? null,
      capturedBy: ctx.userId,
    },
  });

  return { ok: true };
}

export async function saveSignature(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  const parsed = inspectionSignatureSchema.safeParse({
    inspectionId: formData.get("inspectionId"),
    role: formData.get("role"),
    name: formData.get("name"),
    dataUrl: formData.get("dataUrl"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid signature" };
  const data = parsed.data;

  const inspection = await prisma.inspection.findFirst({
    where: { id: data.inspectionId, orgId: ctx.orgId },
  });
  if (!inspection) return { ok: false, error: "Inspection not found" };

  const existing = await prisma.signature.findFirst({
    where: { inspectionId: inspection.id, role: data.role },
  });

  if (existing) {
    await prisma.signature.update({ where: { id: existing.id }, data: { name: data.name, dataUrl: data.dataUrl } });
  } else {
    await prisma.signature.create({
      data: {
        orgId: ctx.orgId,
        inspectionId: inspection.id,
        rentalId: inspection.rentalId,
        role: data.role,
        name: data.name,
        dataUrl: data.dataUrl,
        createdBy: ctx.userId,
      },
    });
  }

  return { ok: true, message: "Signature saved" };
}

export async function completeInspection(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission(PERMISSIONS.finalizeInspection);
  const parsed = inspectionCompleteSchema.safeParse({ inspectionId: formData.get("inspectionId") });
  if (!parsed.success) return { ok: false, error: "Invalid inspection" };

  const inspection = await prisma.inspection.findFirst({
    where: { id: parsed.data.inspectionId, orgId: ctx.orgId },
    include: {
      rental: { include: { asset: true, deposits: true } },
      photos: true,
      signatures: true,
    },
  });
  if (!inspection) return { ok: false, error: "Inspection not found" };
  if (inspection.status === "completed") return { ok: false, error: "Inspection already completed" };

  const settings = await getOrgSettings(ctx.orgId);

  if (inspection.type === "handover") {
    const requiredPhotos = settings.inspectionSettings.requiredPhotoCategories;
    const capturedCategories = new Set(inspection.photos.map((p) => p.category).filter(Boolean));
    const missing = requiredPhotos.filter((c) => !capturedCategories.has(c));
    if (missing.length > 0) {
      return { ok: false, error: `Required photos missing: ${missing.join(", ")}.` };
    }
    if (settings.inspectionSettings.requireCustomerSignature) {
      const customerSigned = inspection.signatures.some((s) => s.role === "customer");
      if (!customerSigned) {
        return { ok: false, error: "Customer signature is required before activating the rental." };
      }
    }
  }

  const rental = inspection.rental;

  if (inspection.type === "handover") {
    await prisma.$transaction(async (tx) => {
      await tx.inspection.update({ where: { id: inspection.id }, data: { status: "completed", completedAt: new Date() } });
      await tx.rental.update({ where: { id: rental.id }, data: { status: "active" } });
      await tx.asset.update({ where: { id: rental.assetId }, data: { status: "rented" } });
    });
    await audit({
      orgId: ctx.orgId,
      userId: ctx.userId,
      action: "inspection",
      entityType: "inspection",
      entityId: inspection.id,
      description: `Handover inspection completed and rental ${rental.rentalNo} activated`,
    });
  } else {
    // ---- Return flow: compute charges and finalize ----
    const rules = settings.rentalRules;
    const actualReturnAt = new Date();
    const chargesToApply: { type: string; description: string; amount: PrismaDecimalT }[] = [];

    // Mileage difference for vehicles
    const handover = await prisma.inspection.findUnique({
      where: { rentalId_type: { rentalId: rental.id, type: "handover" } },
      select: { mileage: true, engineHours: true, fuelLevel: true },
    });

    if (handover?.mileage != null && inspection.mileage != null && inspection.mileage > handover.mileage) {
      const distance = inspection.mileage - handover.mileage;
      // No automatic mileage charge unless configured; record usage in notes only.
      await prisma.rental.update({
        where: { id: rental.id },
        data: { notes: `${rental.notes ?? ""}\nDistance traveled: ${distance} km`.trim() },
      });
    }

    if (handover?.fuelLevel != null && inspection.fuelLevel != null) {
      const fuel = computeFuelCharge({
        fuelAtHandover: handover.fuelLevel,
        fuelAtReturn: inspection.fuelLevel,
        requiredReturnLevel: rules.fuelRequiredReturnLevel,
        pricePerPercent: rules.fuelPricePerPercent,
      });
      if (fuel.charge.greaterThan(0)) {
        chargesToApply.push({ type: "fuel", description: `Fuel shortage (returned at ${inspection.fuelLevel}%, required ${rules.fuelRequiredReturnLevel}%)`, amount: fuel.charge });
      }
    }

    const late = computeLateFee({
      expectedReturnAt: rental.expectedReturnAt,
      actualReturnAt,
      rule: {
        enabled: rules.lateFeeEnabled,
        graceMinutes: rules.lateFeeGraceMinutes,
        unit: rules.lateFeeUnit,
        ratePerUnit: rules.lateFeeRate,
        capAmount: rules.lateFeeCap ?? undefined,
      },
    });
    if (late.fee.greaterThan(0)) {
      chargesToApply.push({ type: "late", description: `Late return (${late.overdueMinutes} minutes overdue)`, amount: late.fee });
    }

    // Missing accessories -> charge. Use the configured rate from the rental's rate as a placeholder? No: only charge explicitly configured. For MVP, missing items create charge only when a "missing" unit rate is configured — we use 0 unless a damage exists.
    // New damages -> estimated repair cost is NOT auto-charged. It must be approved by a manager via deposit flow.

    await prisma.$transaction(async (tx) => {
      await tx.inspection.update({ where: { id: inspection.id }, data: { status: "completed", completedAt: actualReturnAt } });

      for (const charge of chargesToApply) {
        await tx.rentalCharge.create({
          data: {
            orgId: ctx.orgId,
            rentalId: rental.id,
            type: charge.type,
            description: charge.description,
            amount: toDecimal(charge.amount),
            appliedBy: ctx.userId,
          },
        });
      }

      const chargesAgg = await tx.rentalCharge.aggregate({ where: { rentalId: rental.id, orgId: ctx.orgId }, _sum: { amount: true } });
      const chargesTotal = chargesAgg._sum.amount ?? toDecimal(0);
      const taxable = money.sub(money.add(rental.baseTotal, chargesTotal), rental.discount);
      const taxTotal = money.mul(taxable, rental.taxPercent).div(100);
      const totalAmount = money.add(taxable, taxTotal);
      const balance = money.sub(totalAmount, rental.amountPaid);

      await tx.rental.update({
        where: { id: rental.id },
        data: {
          status: "completed",
          actualReturnAt,
          chargesTotal,
          taxTotal,
          totalAmount,
          balance,
        },
      });
      await tx.asset.update({ where: { id: rental.assetId }, data: { status: "available" } });
    });

    await audit({
      orgId: ctx.orgId,
      userId: ctx.userId,
      action: "inspection",
      entityType: "inspection",
      entityId: inspection.id,
      description: `Return inspection completed for ${rental.rentalNo}. Charges applied: ${chargesToApply.length}`,
    });

    await notify({
      orgId: ctx.orgId,
      type: "rental_due",
      title: "Rental completed",
      body: `Rental ${rental.rentalNo} was returned and completed. Finalize the deposit to refund ${rental.deposits[0]?.amount ?? 0}.`,
      link: `/rentals/${rental.id}`,
    });
  }

  revalidatePath(`/rentals/${rental.id}`);
  return { ok: true, message: inspection.type === "handover" ? "Rental activated" : "Return completed" };
}

type PrismaDecimalT = ReturnType<typeof toDecimal>;
