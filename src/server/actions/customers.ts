"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOrg, requirePermission } from "@/services/access";
import { customerSchema } from "@/lib/validators";
import { PERMISSIONS } from "@/lib/constants";
import { audit } from "@/services/audit";
import { notify } from "@/services/notify";
import { nextCustomerNo } from "@/services/counters";
import type { ActionResult } from "@/lib/actions";

function parseCustomer(formData: FormData) {
  return customerSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address: formData.get("address"),
    city: formData.get("city"),
    country: formData.get("country"),
    idType: formData.get("idType"),
    idNumber: formData.get("idNumber"),
    idExpiry: formData.get("idExpiry"),
    licenseNumber: formData.get("licenseNumber"),
    licenseExpiry: formData.get("licenseExpiry"),
    emergencyContactName: formData.get("emergencyContactName"),
    emergencyContactPhone: formData.get("emergencyContactPhone"),
    notes: formData.get("notes"),
  });
}

export async function createCustomer(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission(PERMISSIONS.createCustomer);
  const parsed = parseCustomer(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const data = parsed.data;
  const customerNo = await nextCustomerNo(ctx.orgId);

  const customer = await prisma.customer.create({
    data: {
      orgId: ctx.orgId,
      customerNo,
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      address: data.address || null,
      city: data.city || null,
      country: data.country || null,
      idType: data.idType || null,
      idNumber: data.idNumber || null,
      idExpiry: data.idExpiry ? new Date(data.idExpiry) : null,
      licenseNumber: data.licenseNumber || null,
      licenseExpiry: data.licenseExpiry ? new Date(data.licenseExpiry) : null,
      emergencyContactName: data.emergencyContactName || null,
      emergencyContactPhone: data.emergencyContactPhone || null,
      notes: data.notes || null,
    },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: "created",
    entityType: "customer",
    entityId: customer.id,
    description: `Created customer ${customer.name} (${customer.customerNo})`,
  });

  await notify({
    orgId: ctx.orgId,
    type: "new_customer",
    title: "New customer added",
    body: `${customer.name} was added as a customer.`,
    link: `/customers/${customer.id}`,
  });

  revalidatePath("/customers");
  return { ok: true, message: "Customer created" };
}

export async function updateCustomer(prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission(PERMISSIONS.manageCustomers);
  const id = String(formData.get("id") ?? "");
  const parsed = parseCustomer(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const existing = await prisma.customer.findFirst({ where: { id, orgId: ctx.orgId } });
  if (!existing) return { ok: false, error: "Customer not found" };

  const data = parsed.data;
  await prisma.customer.update({
    where: { id },
    data: {
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      address: data.address || null,
      city: data.city || null,
      country: data.country || null,
      idType: data.idType || null,
      idNumber: data.idNumber || null,
      idExpiry: data.idExpiry ? new Date(data.idExpiry) : null,
      licenseNumber: data.licenseNumber || null,
      licenseExpiry: data.licenseExpiry ? new Date(data.licenseExpiry) : null,
      emergencyContactName: data.emergencyContactName || null,
      emergencyContactPhone: data.emergencyContactPhone || null,
      notes: data.notes || null,
    },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: "updated",
    entityType: "customer",
    entityId: id,
    description: `Updated customer ${existing.name}`,
  });

  revalidatePath(`/customers/${id}`);
  return { ok: true, message: "Customer updated" };
}

export async function archiveCustomer(prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission(PERMISSIONS.manageCustomers);
  const id = String(formData.get("id") ?? "");
  const customer = await prisma.customer.findFirst({ where: { id, orgId: ctx.orgId } });
  if (!customer) return { ok: false, error: "Customer not found" };

  await prisma.customer.update({ where: { id }, data: { status: "archived" } });
  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: "archived",
    entityType: "customer",
    entityId: id,
    description: `Archived customer ${customer.name}`,
  });
  revalidatePath("/customers");
  return { ok: true, message: "Customer archived" };
}
