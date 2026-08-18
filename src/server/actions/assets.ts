"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/services/access";
import { assetSchema, categorySchema } from "@/lib/validators";
import { PERMISSIONS, ASSET_STATUSES } from "@/lib/constants";
import { audit } from "@/services/audit";
import { nextAssetNo } from "@/services/counters";
import { toDecimal } from "@/lib/decimal";
import { serializeCustomFields, parseCustomFields, parseCustomFieldValues, serializeCustomFieldValues, sanitizeCustomFieldValues } from "@/lib/custom-fields";
import type { ActionResult } from "@/lib/actions";

export async function createCategory(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission(PERMISSIONS.manageAssets);

  let customFields: unknown = [];
  const rawFields = formData.get("customFields");
  if (rawFields && String(rawFields).trim()) {
    try {
      customFields = JSON.parse(String(rawFields));
    } catch {
      return { ok: false, error: "Invalid custom fields" };
    }
  }

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind"),
    description: formData.get("description"),
    customFields,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const existing = await prisma.assetCategory.findFirst({
    where: { orgId: ctx.orgId, name: parsed.data.name },
  });
  if (existing) return { ok: false, error: "A category with this name already exists" };

  await prisma.assetCategory.create({
    data: {
      orgId: ctx.orgId,
      name: parsed.data.name,
      kind: parsed.data.kind,
      description: parsed.data.description || null,
      customFieldsJson: serializeCustomFields(parsed.data.customFields),
    },
  });
  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: "created",
    entityType: "assetCategory",
    description: `Created category ${parsed.data.name}`,
  });
  revalidatePath("/assets");
  return { ok: true, message: "Category created" };
}

export async function createAsset(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission(PERMISSIONS.createAsset);
  const parsed = assetSchema.safeParse({
    name: formData.get("name"),
    categoryId: formData.get("categoryId"),
    brand: formData.get("brand"),
    model: formData.get("model"),
    serialNumber: formData.get("serialNumber"),
    registrationNumber: formData.get("registrationNumber"),
    vin: formData.get("vin"),
    engineNumber: formData.get("engineNumber"),
    year: formData.get("year"),
    color: formData.get("color"),
    mileage: formData.get("mileage"),
    engineHours: formData.get("engineHours"),
    fuelLevel: formData.get("fuelLevel"),
    oilLevel: formData.get("oilLevel"),
    powerOutput: formData.get("powerOutput"),
    location: formData.get("location"),
    purchaseDate: formData.get("purchaseDate"),
    purchasePrice: formData.get("purchasePrice"),
    currentValue: formData.get("currentValue"),
    insuranceExpiry: formData.get("insuranceExpiry"),
    registrationExpiry: formData.get("registrationExpiry"),
    inspectionExpiry: formData.get("inspectionExpiry"),
    description: formData.get("description"),
    notes: formData.get("notes"),
    status: formData.get("status"),
    customFieldsJson: formData.get("customFieldsJson"),
  });

  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const data = parsed.data;
  const category = await prisma.assetCategory.findFirst({
    where: { id: data.categoryId, orgId: ctx.orgId },
  });
  if (!category) return { ok: false, error: "Category not found" };

  const defs = parseCustomFields(category.customFieldsJson);
  const values = data.customFieldsJson ? parseCustomFieldValues(data.customFieldsJson) : {};
  const customFieldsJson = serializeCustomFieldValues(sanitizeCustomFieldValues(values, defs));

  const assetNo = await nextAssetNo(ctx.orgId);
  const asset = await prisma.asset.create({
    data: {
      orgId: ctx.orgId,
      assetNo,
      name: data.name,
      categoryId: data.categoryId,
      brand: data.brand || null,
      model: data.model || null,
      serialNumber: data.serialNumber || null,
      registrationNumber: data.registrationNumber || null,
      vin: data.vin || null,
      engineNumber: data.engineNumber || null,
      year: data.year ?? null,
      color: data.color || null,
      mileage: data.mileage ?? null,
      engineHours: data.engineHours ?? null,
      fuelLevel: data.fuelLevel ?? null,
      oilLevel: data.oilLevel || null,
      powerOutput: data.powerOutput || null,
      location: data.location || null,
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
      purchasePrice: data.purchasePrice != null ? toDecimal(data.purchasePrice) : null,
      currentValue: data.currentValue != null ? toDecimal(data.currentValue) : null,
      insuranceExpiry: data.insuranceExpiry ? new Date(data.insuranceExpiry) : null,
      registrationExpiry: data.registrationExpiry ? new Date(data.registrationExpiry) : null,
      inspectionExpiry: data.inspectionExpiry ? new Date(data.inspectionExpiry) : null,
      description: data.description || null,
      notes: data.notes || null,
      status: data.status,
      customFieldsJson,
    },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: "created",
    entityType: "asset",
    entityId: asset.id,
    description: `Created asset ${asset.name} (${asset.assetNo})`,
  });

  revalidatePath("/assets");
  return { ok: true, message: "Asset created" };
}


export async function updateAssetStatus(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission(PERMISSIONS.manageAssets);
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!(ASSET_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, error: "Invalid asset status" };
  }

  const asset = await prisma.asset.findFirst({ where: { id, orgId: ctx.orgId } });
  if (!asset) return { ok: false, error: "Asset not found" };

  await prisma.asset.update({ where: { id }, data: { status } });
  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: "status_change",
    entityType: "asset",
    entityId: id,
    description: `Changed asset ${asset.name} status to ${status}`,
    changes: { from: asset.status, to: status },
  });
  revalidatePath(`/assets/${id}`);
  return { ok: true, message: "Status updated" };
}

export async function retireAsset(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission(PERMISSIONS.manageAssets);
  const id = String(formData.get("id") ?? "");
  const asset = await prisma.asset.findFirst({ where: { id, orgId: ctx.orgId } });
  if (!asset) return { ok: false, error: "Asset not found" };

  await prisma.asset.update({ where: { id }, data: { status: "retired" } });
  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: "updated",
    entityType: "asset",
    entityId: id,
    description: `Retired asset ${asset.name}. History is preserved.`,
  });
  revalidatePath("/assets");
  return { ok: true, message: "Asset retired" };
}
