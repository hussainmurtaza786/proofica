"use server";

import { revalidatePath } from "next/cache";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/services/access";
import { PERMISSIONS } from "@/lib/constants";
import { audit } from "@/services/audit";
import type { ActionResult } from "@/lib/actions";

export async function createShareLink(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission(PERMISSIONS.manageRentals);
  const rentalId = String(formData.get("rentalId") ?? "");
  const rental = await prisma.rental.findFirst({ where: { id: rentalId, orgId: ctx.orgId } });
  if (!rental) return { ok: false, error: "Rental not found" };

  const existing = await prisma.shareLink.findFirst({
    where: { orgId: ctx.orgId, rentalId, revokedAt: null },
  });

  const token = existing?.token ?? crypto.randomBytes(16).toString("hex");

  if (!existing) {
    await prisma.shareLink.create({
      data: {
        orgId: ctx.orgId,
        rentalId,
        token,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  }

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: "created",
    entityType: "shareLink",
    entityId: rental.id,
    description: `Created share link for ${rental.rentalNo}`,
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  revalidatePath(`/rentals/${rental.id}`);
  return { ok: true, message: "Share link created", redirect: `${baseUrl}/share/${token}` };
}

export async function revokeShareLink(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission(PERMISSIONS.manageRentals);
  const id = String(formData.get("id") ?? "");
  await prisma.shareLink.updateMany({ where: { id, orgId: ctx.orgId }, data: { revokedAt: new Date() } });
  revalidatePath("/rentals");
  return { ok: true, message: "Share link revoked" };
}
