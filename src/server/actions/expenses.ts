"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/services/access";
import { expenseSchema, budgetSchema, maintenanceSchema } from "@/lib/validators";
import { PERMISSIONS } from "@/lib/constants";
import { toDecimal } from "@/lib/decimal";
import { audit } from "@/services/audit";
import { notify } from "@/services/notify";
import type { ActionResult } from "@/lib/actions";

export async function createExpense(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission(PERMISSIONS.manageExpenses);
  const parsed = expenseSchema.safeParse({
    assetId: formData.get("assetId"),
    category: formData.get("category"),
    amount: formData.get("amount"),
    date: formData.get("date"),
    vendor: formData.get("vendor"),
    description: formData.get("description"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  await prisma.expense.create({
    data: {
      orgId: ctx.orgId,
      assetId: data.assetId || null,
      category: data.category,
      amount: toDecimal(data.amount),
      date: new Date(data.date),
      vendor: data.vendor || null,
      description: data.description || null,
      createdBy: ctx.userId,
    },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: "created",
    entityType: "expense",
    description: `Recorded ${data.category} expense of ${data.amount}`,
  });

  revalidatePath("/expenses");
  return { ok: true, message: "Expense recorded" };
}

export async function createBudget(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission(PERMISSIONS.manageBudgets);
  const parsed = budgetSchema.safeParse({
    category: formData.get("category"),
    period: formData.get("period"),
    amount: formData.get("amount"),
    month: formData.get("month"),
    year: formData.get("year"),
    threshold: formData.get("threshold"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  // Normalize month: monthly budgets carry the month, yearly budgets use 0 so
  // the compound unique key stays consistent between findUnique and create.
  const month = data.period === "monthly" ? (data.month ?? new Date().getMonth() + 1) : 0;

  const existing = await prisma.budget.findUnique({
    where: {
      orgId_category_period_month_year: {
        orgId: ctx.orgId,
        category: data.category,
        period: data.period,
        month,
        year: data.year,
      },
    },
  });

  if (existing) {
    await prisma.budget.update({
      where: { id: existing.id },
      data: { amount: toDecimal(data.amount), threshold: toDecimal(data.threshold) },
    });
  } else {
    await prisma.budget.create({
      data: {
        orgId: ctx.orgId,
        category: data.category,
        period: data.period,
        amount: toDecimal(data.amount),
        month,
        year: data.year,
        threshold: toDecimal(data.threshold),
      },
    });
  }

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: "created",
    entityType: "budget",
    description: `Set ${data.category} budget for ${data.period} ${data.month ?? ""} ${data.year} to ${data.amount}`,
  });

  revalidatePath("/budgets");
  return { ok: true, message: "Budget saved" };
}

export async function createMaintenance(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission(PERMISSIONS.manageMaintenance);
  const parsed = maintenanceSchema.safeParse({
    assetId: formData.get("assetId"),
    type: formData.get("type"),
    date: formData.get("date"),
    cost: formData.get("cost"),
    vendor: formData.get("vendor"),
    description: formData.get("description"),
    mileage: formData.get("mileage"),
    engineHours: formData.get("engineHours"),
    nextDate: formData.get("nextDate"),
    nextMileage: formData.get("nextMileage"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const asset = await prisma.asset.findFirst({ where: { id: data.assetId, orgId: ctx.orgId } });
  if (!asset) return { ok: false, error: "Asset not found" };

  await prisma.$transaction(async (tx) => {
    await tx.maintenance.create({
      data: {
        orgId: ctx.orgId,
        assetId: data.assetId,
        type: data.type,
        date: new Date(data.date),
        cost: toDecimal(data.cost),
        vendor: data.vendor || null,
        description: data.description || null,
        mileage: data.mileage ?? null,
        engineHours: data.engineHours ?? null,
        nextDate: data.nextDate ? new Date(data.nextDate) : null,
        nextMileage: data.nextMileage ?? null,
        status: data.status,
        createdBy: ctx.userId,
      },
    });

    if (data.cost > 0) {
      await tx.expense.create({
        data: {
          orgId: ctx.orgId,
          assetId: data.assetId,
          category: "maintenance",
          amount: toDecimal(data.cost),
          date: new Date(data.date),
          vendor: data.vendor || null,
          description: data.description ? `Maintenance (${data.type}): ${data.description}` : `Maintenance (${data.type})`,
          createdBy: ctx.userId,
        },
      });
    }

    if (data.status === "in_progress" || data.status === "scheduled") {
      await tx.asset.update({ where: { id: data.assetId }, data: { status: "maintenance" } });
    } else if (data.status === "completed") {
      const active = await tx.rental.count({
        where: { assetId: data.assetId, orgId: ctx.orgId, status: { in: ["active", "overdue", "due_soon"] } },
      });
      await tx.asset.update({
        where: { id: data.assetId },
        data: { status: active > 0 ? "rented" : "available", mileage: data.mileage ?? asset.mileage, engineHours: data.engineHours ?? asset.engineHours },
      });
    }
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: "created",
    entityType: "maintenance",
    description: `Scheduled ${data.type} maintenance on ${asset.name}`,
  });

  if (data.nextDate) {
    await notify({
      orgId: ctx.orgId,
      type: "maintenance_due",
      title: "Next maintenance scheduled",
      body: `${asset.name} is due for ${data.type} maintenance.`,
      link: `/maintenance`,
    });
  }

  revalidatePath("/maintenance");
  return { ok: true, message: "Maintenance saved" };
}

export async function completeMaintenance(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission(PERMISSIONS.manageMaintenance);
  const id = String(formData.get("id") ?? "");
  const record = await prisma.maintenance.findFirst({ where: { id, orgId: ctx.orgId }, include: { asset: true } });
  if (!record) return { ok: false, error: "Maintenance record not found" };

  await prisma.$transaction(async (tx) => {
    await tx.maintenance.update({ where: { id }, data: { status: "completed" } });
    const active = await tx.rental.count({
      where: { assetId: record.assetId, orgId: ctx.orgId, status: { in: ["active", "overdue", "due_soon"] } },
    });
    await tx.asset.update({
      where: { id: record.assetId },
      data: { status: active > 0 ? "rented" : "available" },
    });
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: "updated",
    entityType: "maintenance",
    entityId: id,
    description: `Completed maintenance on ${record.asset.name}`,
  });

  revalidatePath("/maintenance");
  return { ok: true, message: "Maintenance completed" };
}

export async function checkBudgetThresholds() {
  const ctx = await requirePermission(PERMISSIONS.manageBudgets);
  const orgId = ctx.orgId;
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  const budgets = await prisma.budget.findMany({
    where: { orgId, year },
  });

  for (const budget of budgets) {
    const where = {
      orgId,
      category: budget.category,
      date: budget.period === "monthly" && budget.month
        ? { gte: new Date(year, budget.month - 1, 1), lt: new Date(year, budget.month, 1) }
        : { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
    };
    const spent = await prisma.expense.aggregate({ where, _sum: { amount: true } });
    const spentAmount = spent._sum.amount ?? toDecimal(0);
    if (budget.amount.greaterThan(0) && spentAmount.mul(100).div(budget.amount).greaterThanOrEqualTo(budget.threshold)) {
      const pct = Math.floor(spentAmount.mul(100).div(budget.amount).toNumber());
      await notify({
        orgId,
        type: "budget_threshold",
        title: `Budget threshold reached (${pct}%)`,
        body: `You have used ${pct}% of the ${budget.category} budget.`,
        link: "/budgets",
      });
    }
  }
}
