import "server-only";

import { prisma } from "@/lib/prisma";

function redactId(value: string | null): string {
  if (!value || value.length <= 4) return value ?? "";
  return "*".repeat(value.length - 4) + value.slice(-4);
}

export async function getRentalReportData(orgId: string, rentalId: string) {
  const [org, rental] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId } }),
    prisma.rental.findFirst({
      where: { id: rentalId, orgId },
      include: {
        customer: true,
        asset: true,
        payments: { orderBy: { receivedAt: "asc" } },
        charges: { orderBy: { appliedAt: "asc" } },
        deposits: true,
        inspections: true,
      },
    }),
  ]);

  if (!org || !rental) return null;

  return {
    org: {
      name: org.name,
      address: org.address,
      phone: org.phone,
      email: org.email,
      currency: org.currency,
    },
    rental: {
      rentalNo: rental.rentalNo,
      status: rental.status,
      startAt: rental.startAt,
      expectedReturnAt: rental.expectedReturnAt,
      actualReturnAt: rental.actualReturnAt,
      pricingModel: rental.pricingModel,
      rate: rental.rate,
      quantity: rental.quantity,
      depositRequired: rental.depositRequired,
      depositHeld: rental.depositHeld,
      discount: rental.discount,
      taxPercent: rental.taxPercent,
      baseTotal: rental.baseTotal,
      chargesTotal: rental.chargesTotal,
      taxTotal: rental.taxTotal,
      totalAmount: rental.totalAmount,
      amountPaid: rental.amountPaid,
      balance: rental.balance,
      notes: rental.notes,
      createdAt: rental.createdAt,
      customer: {
        name: rental.customer.name,
        customerNo: rental.customer.customerNo,
        phone: rental.customer.phone,
        email: rental.customer.email,
        address: rental.customer.address,
        idType: rental.customer.idType,
        idNumber: redactId(rental.customer.idNumber),
      },
      asset: {
        name: rental.asset.name,
        assetNo: rental.asset.assetNo,
        registrationNumber: rental.asset.registrationNumber,
      },
      payments: rental.payments.map((p) => ({
        type: p.type,
        method: p.method,
        amount: p.amount,
        receivedAt: p.receivedAt,
        reference: p.reference,
      })),
      charges: rental.charges.map((ch) => ({ type: ch.type, description: ch.description, amount: ch.amount })),
      deposit: rental.deposits[0]
        ? { amount: rental.deposits[0].amount, status: rental.deposits[0].status }
        : null,
      inspections: rental.inspections.map((i) => ({
        type: i.type,
        status: i.status,
        performedAt: i.completedAt ?? i.startedAt,
      })),
    },
  };
}
