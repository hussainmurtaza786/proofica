"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/services/access";
import { rentalSchema, rentalChargeSchema, extensionSchema } from "@/lib/validators";
import { PERMISSIONS } from "@/lib/constants";
import { toDecimal, money } from "@/lib/decimal";
import { audit } from "@/services/audit";
import { notify } from "@/services/notify";
import { nextRentalNo } from "@/services/counters";
import { isAssetAvailable } from "@/services/availability";
import { computeRentalTotals, computeDurationHours, computeLateFee } from "@/lib/rental-math";
import { getOrgSettings } from "@/services/settings";
import type { ActionResult } from "@/lib/actions";

export async function createRental(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission(PERMISSIONS.createRental);

  const parsed = rentalSchema.safeParse({
    customerId: formData.get("customerId"),
    assetId: formData.get("assetId"),
    startAt: formData.get("startAt"),
    expectedReturnAt: formData.get("expectedReturnAt"),
    pricingModel: formData.get("pricingModel"),
    rate: formData.get("rate"),
    quantity: formData.get("quantity"),
    depositRequired: formData.get("depositRequired"),
    discount: formData.get("discount"),
    taxPercent: formData.get("taxPercent"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const startAt = new Date(data.startAt);
  const expectedReturnAt = new Date(data.expectedReturnAt);
  if (expectedReturnAt <= startAt) return { ok: false, error: "Return date must be after start date" };

  const customer = await prisma.customer.findFirst({ where: { id: data.customerId, orgId: ctx.orgId } });
  if (!customer) return { ok: false, error: "Customer not found" };

  const asset = await prisma.asset.findFirst({ where: { id: data.assetId, orgId: ctx.orgId } });
  if (!asset) return { ok: false, error: "Asset not found" };

  const { available, conflicts } = await isAssetAvailable(ctx.orgId, data.assetId, startAt, expectedReturnAt);
  if (!available) {
    const detail = conflicts[0]?.rentalNo ?? asset.status;
    return { ok: false, error: `Asset is not available for this period (${detail}).` };
  }

  const settings = await getOrgSettings(ctx.orgId);
  const hours = computeDurationHours(startAt, expectedReturnAt);
  const breakdown = computeRentalTotals({
    pricingModel: data.pricingModel,
    rate: data.rate,
    quantity: data.quantity,
    hours,
    calendarDays: settings.rentalRules.roundingRule === "calendar_unit" ? hours / 24 : undefined,
    discount: data.discount,
    taxPercent: data.taxPercent,
    rounding: settings.rentalRules.roundingRule,
  });

  const rentalNo = await nextRentalNo(ctx.orgId);

  const rental = await prisma.$transaction(async (tx) => {
    const created = await tx.rental.create({
      data: {
        orgId: ctx.orgId,
        rentalNo,
        customerId: data.customerId,
        assetId: data.assetId,
        status: "reserved",
        pricingModel: data.pricingModel,
        rate: toDecimal(data.rate),
        quantity: data.quantity,
        depositRequired: toDecimal(data.depositRequired),
        discount: toDecimal(data.discount),
        taxPercent: toDecimal(data.taxPercent),
        baseTotal: breakdown.gross,
        chargesTotal: breakdown.charges,
        taxTotal: breakdown.taxAmount,
        totalAmount: breakdown.total,
        depositHeld: toDecimal(0),
        amountPaid: toDecimal(0),
        balance: breakdown.total,
        startAt,
        expectedReturnAt,
        durationHours: toDecimal(hours),
        notes: data.notes || null,
        createdBy: ctx.userId,
      },
    });

    if (data.depositRequired > 0) {
      await tx.deposit.create({
        data: {
          orgId: ctx.orgId,
          rentalId: created.id,
          amount: toDecimal(data.depositRequired),
          status: "pending",
        },
      });
    }

    await tx.asset.update({ where: { id: data.assetId }, data: { status: "reserved" } });
    return created;
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: "created",
    entityType: "rental",
    entityId: rental.id,
    description: `Created rental ${rentalNo} for ${customer.name} on ${data.quantity > 1 ? `${data.quantity} × ` : ""}${asset.name}`,
  });

  await notify({
    orgId: ctx.orgId,
    type: "rental_due",
    title: "Rental reserved",
    body: `Rental ${rentalNo} is reserved and awaiting handover.`,
    link: `/rentals/${rental.id}`,
  });

  revalidatePath("/rentals");
  return { ok: true, message: "Rental created", redirect: `/rentals/${rental.id}` };
}

export async function addRentalCharge(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission(PERMISSIONS.manageRentals);
  const parsed = rentalChargeSchema.safeParse({
    rentalId: formData.get("rentalId"),
    type: formData.get("type"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    qty: formData.get("qty"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const rental = await prisma.rental.findFirst({ where: { id: data.rentalId, orgId: ctx.orgId } });
  if (!rental) return { ok: false, error: "Rental not found" };

  const total = money.mul(data.amount, data.qty);

  await prisma.$transaction(async (tx) => {
    await tx.rentalCharge.create({
      data: {
        orgId: ctx.orgId,
        rentalId: data.rentalId,
        type: data.type,
        description: data.description,
        amount: total,
        qty: toDecimal(data.qty),
        unitRate: toDecimal(data.amount),
        reason: data.reason || null,
        appliedBy: ctx.userId,
      },
    });
    const charges = await tx.rentalCharge.aggregate({
      where: { rentalId: data.rentalId, orgId: ctx.orgId },
      _sum: { amount: true },
    });
    const chargesTotal = charges._sum.amount ?? toDecimal(0);

    const discountAmount = rental.discount;
    const taxPercent = rental.taxPercent;
    const taxable = money.sub(money.add(rental.baseTotal, chargesTotal), discountAmount);
    const taxTotal = money.mul(taxable, toDecimal(taxPercent)).div(100);
    const totalAmount = money.add(taxable, taxTotal);
    const balance = money.sub(totalAmount, rental.amountPaid);

    await tx.rental.update({
      where: { id: data.rentalId },
      data: { chargesTotal, taxTotal, totalAmount, balance },
    });
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: "updated",
    entityType: "rental",
    entityId: data.rentalId,
    description: `Added charge "${data.description}" of ${total} to ${rental.rentalNo}`,
  });

  revalidatePath(`/rentals/${data.rentalId}`);
  return { ok: true, message: "Charge added" };
}

export async function extendRental(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission(PERMISSIONS.manageRentals);
  const parsed = extensionSchema.safeParse({
    rentalId: formData.get("rentalId"),
    toAt: formData.get("toAt"),
    additionalCost: formData.get("additionalCost"),
    additionalDeposit: formData.get("additionalDeposit"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const rental = await prisma.rental.findFirst({
    where: { id: data.rentalId, orgId: ctx.orgId },
    include: { asset: true },
  });
  if (!rental) return { ok: false, error: "Rental not found" };

  const toAt = new Date(data.toAt);
  if (toAt <= rental.expectedReturnAt) {
    return { ok: false, error: "New return date must be after the current return date" };
  }

  const { available, conflicts } = await isAssetAvailable(
    ctx.orgId,
    rental.assetId,
    rental.expectedReturnAt,
    toAt,
    rental.id
  );
  if (!available) return { ok: false, error: "The asset is not available for the extended period" };

  const settings = await getOrgSettings(ctx.orgId);
  const hours = computeDurationHours(rental.expectedReturnAt, toAt);
  const breakdown = computeRentalTotals({
    pricingModel: rental.pricingModel,
    rate: rental.rate,
    quantity: rental.quantity,
    hours,
    rounding: settings.rentalRules.roundingRule,
  });

  await prisma.$transaction(async (tx) => {
    await tx.rentalExtension.create({
      data: {
        orgId: ctx.orgId,
        rentalId: rental.id,
        fromAt: rental.expectedReturnAt,
        toAt,
        durationHours: toDecimal(hours),
        additionalCost: data.additionalCost > 0 ? toDecimal(data.additionalCost) : breakdown.total,
        additionalDeposit: toDecimal(data.additionalDeposit),
        createdBy: ctx.userId,
      },
    });

    const newBaseTotal = money.add(rental.baseTotal, breakdown.gross);
    const newDepositRequired = money.add(rental.depositRequired, data.additionalDeposit);
    const totalAmount = money.add(rental.totalAmount, data.additionalCost > 0 ? data.additionalCost : breakdown.total);
    const newDepositHeld = money.add(rental.depositHeld, data.additionalDeposit);
    const balance = money.sub(totalAmount, rental.amountPaid);

    await tx.rental.update({
      where: { id: rental.id },
      data: {
        expectedReturnAt: toAt,
        baseTotal: newBaseTotal,
        depositRequired: newDepositRequired,
        totalAmount,
        depositHeld: newDepositHeld,
        balance,
        durationHours: money.add(rental.durationHours, toDecimal(hours)),
      },
    });

    if (data.additionalDeposit > 0) {
      const deposit = await tx.deposit.findFirst({ where: { rentalId: rental.id, orgId: ctx.orgId } });
      if (deposit) {
        await tx.deposit.update({
          where: { id: deposit.id },
          data: { amount: money.add(deposit.amount, data.additionalDeposit) },
        });
      } else {
        await tx.deposit.create({
          data: {
            orgId: ctx.orgId,
            rentalId: rental.id,
            amount: toDecimal(data.additionalDeposit),
            status: "pending",
          },
        });
      }
    }
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: "updated",
    entityType: "rental",
    entityId: rental.id,
    description: `Extended rental ${rental.rentalNo} to ${toAt.toISOString()}`,
  });

  await notify({
    orgId: ctx.orgId,
    type: "rental_extension",
    title: "Rental extended",
    body: `Rental ${rental.rentalNo} was extended until ${toAt.toISOString().slice(0, 10)}.`,
    link: `/rentals/${rental.id}`,
  });

  revalidatePath(`/rentals/${rental.id}`);
  return { ok: true, message: "Rental extended" };
}

export async function cancelRental(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission(PERMISSIONS.cancelRental);
  const id = String(formData.get("id") ?? "");
  const rental = await prisma.rental.findFirst({
    where: { id, orgId: ctx.orgId },
    include: { asset: true },
  });
  if (!rental) return { ok: false, error: "Rental not found" };

  await prisma.$transaction(async (tx) => {
    await tx.rental.update({ where: { id }, data: { status: "cancelled" } });
    const otherActive = await tx.rental.count({
      where: {
        assetId: rental.assetId,
        orgId: ctx.orgId,
        status: { in: ["reserved", "awaiting_handover", "active", "due_soon", "overdue"] },
        id: { not: id },
      },
    });
    if (otherActive === 0) {
      await tx.asset.update({ where: { id: rental.assetId }, data: { status: "available" } });
    }
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: "status_change",
    entityType: "rental",
    entityId: id,
    description: `Cancelled rental ${rental.rentalNo}`,
  });

  revalidatePath(`/rentals/${id}`);
  return { ok: true, message: "Rental cancelled" };
}

export async function computeLateFeeNow(rental: { expectedReturnAt: Date; actualReturnAt: Date; orgId: string }) {
  const settings = await getOrgSettings(rental.orgId);
  const rule = settings.rentalRules;
  return computeLateFee({
    expectedReturnAt: rental.expectedReturnAt,
    actualReturnAt: rental.actualReturnAt,
    rule: {
      enabled: rule.lateFeeEnabled,
      graceMinutes: rule.lateFeeGraceMinutes,
      unit: rule.lateFeeUnit,
      ratePerUnit: rule.lateFeeRate,
      capAmount: rule.lateFeeCap ?? undefined,
    },
  });
}
