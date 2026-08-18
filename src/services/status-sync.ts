import "server-only";

import { prisma } from "@/lib/prisma";
import { notify } from "@/services/notify";
import { isBefore, isAfter, addDays, addHours } from "date-fns";

/**
 * Status sync + reminder generation. Called on dashboard load (MVP) and can
 * later be moved to a cron / scheduled job without changing this logic.
 */
export async function runOrgJobs(orgId: string) {
  const now = new Date();

  // 1) Overdue rentals
  const overdue = await prisma.rental.findMany({
    where: {
      orgId,
      status: { in: ["active", "due_soon"] },
      expectedReturnAt: { lt: now },
    },
    include: { customer: true, asset: true },
  });
  for (const rental of overdue) {
    const overdueHours = Math.max(1, Math.floor((now.getTime() - rental.expectedReturnAt.getTime()) / 3600000));
    await prisma.rental.update({ where: { id: rental.id }, data: { status: "overdue" } });
    const exists = await prisma.notification.findFirst({
      where: { orgId, type: "rental_overdue", link: `/rentals/${rental.id}`, createdAt: { gte: addDays(now, -2) } },
    });
    if (!exists) {
      await notify({
        orgId,
        type: "rental_overdue",
        title: "Rental overdue",
        body: `${rental.asset.name} is overdue by ${overdueHours} hour(s). Expected return ${rental.expectedReturnAt.toISOString()}.`,
        link: `/rentals/${rental.id}`,
      });
    }
  }

  // 2) Due soon rentals
  const dueSoon = await prisma.rental.findMany({
    where: {
      orgId,
      status: "active",
      expectedReturnAt: { gte: now, lt: addHours(now, 24) },
    },
    include: { customer: true, asset: true },
  });
  for (const rental of dueSoon) {
    await prisma.rental.update({ where: { id: rental.id }, data: { status: "due_soon" } });
    const exists = await prisma.notification.findFirst({
      where: { orgId, type: "rental_due", link: `/rentals/${rental.id}`, createdAt: { gte: addHours(now, -2) } },
    });
    if (!exists) {
      await notify({
        orgId,
        type: "rental_due",
        title: "Return due soon",
        body: `${rental.asset.name} is due for return at ${rental.expectedReturnAt.toISOString()}.`,
        link: `/rentals/${rental.id}`,
      });
    }
  }

  // 3) Pending deposits
  const pendingDeposits = await prisma.rental.findMany({
    where: {
      orgId,
      status: { in: ["reserved", "awaiting_handover", "active", "overdue"] },
      deposits: { some: { status: "pending" } },
      depositRequired: { gt: 0 },
    },
    include: { customer: true },
  });
  for (const rental of pendingDeposits) {
    const exists = await prisma.notification.findFirst({
      where: { orgId, type: "deposit_pending", link: `/rentals/${rental.id}`, createdAt: { gte: addDays(now, -3) } },
    });
    if (!exists) {
      await notify({
        orgId,
        type: "deposit_pending",
        title: "Deposit pending",
        body: `Deposit for ${rental.rentalNo} has not been received yet.`,
        link: `/rentals/${rental.id}`,
      });
    }
  }

  // 4) Outstanding balances (payment overdue)
  const outstanding = await prisma.rental.findMany({
    where: { orgId, balance: { gt: 0 }, status: { in: ["active", "overdue", "completed"] } },
    include: { customer: true },
  });
  for (const rental of outstanding) {
    const exists = await prisma.notification.findFirst({
      where: { orgId, type: "payment_overdue", link: `/rentals/${rental.id}`, createdAt: { gte: addDays(now, -7) } },
    });
    if (!exists && rental.balance.greaterThan(0)) {
      await notify({
        orgId,
        type: "payment_overdue",
        title: "Outstanding balance",
        body: `${rental.rentalNo} has an outstanding balance of ${rental.balance}.`,
        link: `/rentals/${rental.id}`,
      });
    }
  }

  // 5) Document expiries
  const assetsExpiring = await prisma.asset.findMany({
    where: {
      orgId,
      OR: [
        { insuranceExpiry: { gte: now, lt: addDays(now, 30) } },
        { registrationExpiry: { gte: now, lt: addDays(now, 30) } },
        { inspectionExpiry: { gte: now, lt: addDays(now, 30) } },
      ],
    },
  });
  for (const asset of assetsExpiring) {
    const items: { label: string; date: Date }[] = [];
    if (asset.insuranceExpiry && isAfter(asset.insuranceExpiry, now) && isBefore(asset.insuranceExpiry, addDays(now, 30))) {
      items.push({ label: "Insurance", date: asset.insuranceExpiry });
    }
    if (asset.registrationExpiry && isAfter(asset.registrationExpiry, now) && isBefore(asset.registrationExpiry, addDays(now, 30))) {
      items.push({ label: "Registration", date: asset.registrationExpiry });
    }
    if (asset.inspectionExpiry && isAfter(asset.inspectionExpiry, now) && isBefore(asset.inspectionExpiry, addDays(now, 30))) {
      items.push({ label: "Inspection certificate", date: asset.inspectionExpiry });
    }
    for (const item of items) {
      const exists = await prisma.notification.findFirst({
        where: { orgId, type: "document_expiry", body: { contains: asset.name }, createdAt: { gte: addDays(now, -7) } },
      });
      if (!exists) {
        await notify({
          orgId,
          type: "document_expiry",
          title: `${item.label} expiring`,
          body: `${asset.name}: ${item.label} expires in ${Math.ceil((item.date.getTime() - now.getTime()) / 86400000)} days.`,
          link: `/assets/${asset.id}`,
        });
      }
    }
  }

  const customersExpiring = await prisma.customer.findMany({
    where: {
      orgId,
      OR: [{ licenseExpiry: { gte: now, lt: addDays(now, 30) } }, { idExpiry: { gte: now, lt: addDays(now, 30) } }],
    },
  });
  for (const customer of customersExpiring) {
    const days = customer.licenseExpiry
      ? Math.ceil((customer.licenseExpiry.getTime() - now.getTime()) / 86400000)
      : null;
    if (days !== null && days >= 0 && days <= 30) {
      const exists = await prisma.notification.findFirst({
        where: { orgId, type: "document_expiry", body: { contains: customer.name }, createdAt: { gte: addDays(now, -7) } },
      });
      if (!exists) {
        await notify({
          orgId,
          type: "document_expiry",
          title: "License expiring",
          body: `${customer.name}'s driving license expires in ${days} days.`,
          link: `/customers/${customer.id}`,
        });
      }
    }
  }

  // 6) Maintenance due
  const maintenanceDue = await prisma.maintenance.findMany({
    where: {
      orgId,
      status: { in: ["scheduled", "in_progress"] },
      nextDate: { gte: now, lt: addDays(now, 14) },
    },
    include: { asset: true },
  });
  for (const record of maintenanceDue) {
    const exists = await prisma.notification.findFirst({
      where: { orgId, type: "maintenance_due", link: "/maintenance", createdAt: { gte: addDays(now, -7) } },
    });
    if (!exists) {
      await notify({
        orgId,
        type: "maintenance_due",
        title: "Maintenance due",
        body: `${record.asset.name} is due for ${record.type} maintenance.`,
        link: "/maintenance",
      });
    }
  }
}
