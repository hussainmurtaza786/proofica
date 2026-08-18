"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireOrg } from "@/services/access";
import { orgSettingsSchema, rentalRulesSchema, inspectionSettingsSchema, currencySettingsSchema, createMemberSchema } from "@/lib/validators";
import { PERMISSIONS } from "@/lib/constants";
import { audit } from "@/services/audit";
import { saveOrgSetting } from "@/services/settings";
import bcrypt from "bcryptjs";
import type { ActionResult } from "@/lib/actions";

export async function updateOrganization(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission(PERMISSIONS.manageSettings);
  const parsed = orgSettingsSchema.safeParse({
    name: formData.get("name"),
    businessType: formData.get("businessType"),
    currency: formData.get("currency"),
    timezone: formData.get("timezone"),
    address: formData.get("address"),
    phone: formData.get("phone"),
    email: formData.get("email"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  await prisma.organization.update({
    where: { id: ctx.orgId },
    data: {
      name: data.name,
      businessType: data.businessType,
      currency: data.currency,
      timezone: data.timezone,
      address: data.address || null,
      phone: data.phone || null,
      email: data.email || null,
    },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: "updated",
    entityType: "organization",
    entityId: ctx.orgId,
    description: "Updated organization settings",
  });

  revalidatePath("/settings");
  return { ok: true, message: "Settings saved" };
}

export async function updateRentalRules(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission(PERMISSIONS.manageSettings);
  const parsed = rentalRulesSchema.safeParse({
    roundingRule: formData.get("roundingRule"),
    lateFeeEnabled: formData.get("lateFeeEnabled") === "on" || formData.get("lateFeeEnabled") === "true",
    lateFeeGraceMinutes: formData.get("lateFeeGraceMinutes"),
    lateFeeUnit: formData.get("lateFeeUnit"),
    lateFeeRate: formData.get("lateFeeRate"),
    lateFeeCap: formData.get("lateFeeCap") ? formData.get("lateFeeCap") : null,
    depositDeductionAuthThreshold: formData.get("depositDeductionAuthThreshold"),
    fuelRequiredReturnLevel: formData.get("fuelRequiredReturnLevel"),
    fuelPricePerPercent: formData.get("fuelPricePerPercent"),
    returnReminderHours: formData.get("returnReminderHours"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await saveOrgSetting(ctx.orgId, "rentalRules", parsed.data);
  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: "updated",
    entityType: "organization",
    entityId: ctx.orgId,
    description: "Updated rental rules",
  });

  revalidatePath("/settings");
  return { ok: true, message: "Rental rules saved" };
}

export async function updateInspectionSettings(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission(PERMISSIONS.manageSettings);
  const raw = String(formData.get("requiredPhotoCategories") ?? "[]");
  let categories: string[];
  try { categories = JSON.parse(raw) as string[]; } catch { categories = []; }
  const parsed = inspectionSettingsSchema.safeParse({
    requireCustomerSignature: formData.get("requireCustomerSignature") === "on" || formData.get("requireCustomerSignature") === "true",
    requiredPhotoCategories: categories,
  });
  if (!parsed.success) return { ok: false, error: "Invalid inspection settings" };

  await saveOrgSetting(ctx.orgId, "inspectionSettings", parsed.data);
  revalidatePath("/settings");
  return { ok: true, message: "Inspection settings saved" };
}

export async function updateCurrencySettings(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission(PERMISSIONS.manageSettings);
  const parsed = currencySettingsSchema.safeParse({
    displayCurrency: formData.get("displayCurrency") ? formData.get("displayCurrency") : null,
    displayRate: formData.get("displayRate") ? formData.get("displayRate") : 0,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await saveOrgSetting(ctx.orgId, "currencySettings", parsed.data);
  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: "updated",
    entityType: "organization",
    entityId: ctx.orgId,
    description: "Updated currency display settings",
  });

  revalidatePath("/settings");
  return { ok: true, message: "Currency settings saved" };
}

export async function addTeamMember(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission(PERMISSIONS.manageUsers);
  const parsed = createMemberSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    role: formData.get("role"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  let user = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });

  if (!user) {
    const passwordHash = await bcrypt.hash(data.password, 12);
    user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        passwordHash,
        emailVerified: new Date(),
      },
    });
  }

  const existing = await prisma.organizationMember.findUnique({
    where: { orgId_userId: { orgId: ctx.orgId, userId: user.id } },
  });

  if (existing) {
    await prisma.organizationMember.update({
      where: { id: existing.id },
      data: { role: data.role, status: "active" },
    });
  } else {
    await prisma.organizationMember.create({
      data: { orgId: ctx.orgId, userId: user.id, role: data.role },
    });
  }

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: "updated",
    entityType: "organization",
    entityId: ctx.orgId,
    description: `Added ${data.name} as ${data.role}`,
  });

  revalidatePath("/settings");
  return { ok: true, message: "Team member added" };
}

export async function removeTeamMember(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission(PERMISSIONS.manageUsers);
  const memberId = String(formData.get("memberId") ?? "");

  const member = await prisma.organizationMember.findFirst({
    where: { id: memberId, orgId: ctx.orgId },
  });
  if (!member) return { ok: false, error: "Member not found" };
  if (member.role === "Owner" && member.userId === ctx.userId) {
    return { ok: false, error: "You cannot remove yourself as the owner." };
  }

  await prisma.organizationMember.update({ where: { id: memberId }, data: { status: "disabled" } });
  revalidatePath("/settings");
  return { ok: true, message: "Member disabled" };
}

export async function markNotificationRead(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  const id = String(formData.get("id") ?? "");
  await prisma.notification.updateMany({ where: { id, orgId: ctx.orgId }, data: { readAt: new Date() } });
  revalidatePath("/notifications");
  return { ok: true };
}
