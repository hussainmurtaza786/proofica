import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import {
  computeDurationHours,
  hoursToUnits,
  computeRentalTotals,
  computeLateFee,
  computeDepositRefund,
  computeFuelCharge,
  applyPaymentToLedger,
  applyDepositSettlement,
} from "@/lib/rental-math";

const D = (s: string) => new Date(s);

describe("computeDurationHours", () => {
  it("returns 0 for inverted windows", () => {
    expect(computeDurationHours(D("2026-01-01T10:00:00"), D("2026-01-01T08:00:00"))).toBe(0);
  });

  it("counts whole hours", () => {
    expect(computeDurationHours(D("2026-01-01T10:00:00"), D("2026-01-01T14:00:00"))).toBe(4);
  });
});

describe("hoursToUnits", () => {
  it("hourly model always counts at least 1 hour", () => {
    expect(hoursToUnits(0, "hourly")).toBe(1);
    expect(hoursToUnits(3, "hourly")).toBe(3);
  });

  it("daily model rounds up by default", () => {
    expect(hoursToUnits(24, "daily")).toBe(1);
    expect(hoursToUnits(25, "daily")).toBe(2);
    expect(hoursToUnits(3, "daily")).toBe(1);
  });

  it("daily calendar rounding uses calendar days when provided", () => {
    expect(hoursToUnits(30, "daily", "calendar_unit", 2)).toBe(2);
    expect(hoursToUnits(30, "daily", "calendar_unit")).toBe(2);
  });

  it("weekly and monthly round up", () => {
    expect(hoursToUnits(169, "weekly")).toBe(2);
    expect(hoursToUnits(168, "weekly")).toBe(1);
    expect(hoursToUnits(731, "monthly")).toBe(2);
  });

  it("custom is flat", () => {
    expect(hoursToUnits(1000, "custom")).toBe(1);
  });
});

describe("computeRentalTotals", () => {
  it("computes total = gross with no tax", () => {
    const r = computeRentalTotals({ pricingModel: "daily", rate: 100, hours: 48 });
    expect(r.units).toBe(2);
    expect(r.gross.toString()).toBe("200");
    expect(r.total.toString()).toBe("200");
  });

  it("applies discount before tax", () => {
    const r = computeRentalTotals({
      pricingModel: "daily",
      rate: 100,
      hours: 48,
      discount: 50,
      taxPercent: 10,
    });
    expect(r.discountAmount.toString()).toBe("50");
    expect(r.taxable.toString()).toBe("150");
    expect(r.taxAmount.toString()).toBe("15");
    expect(r.total.toString()).toBe("165");
  });

  it("sums additional charges", () => {
    const r = computeRentalTotals({
      pricingModel: "daily",
      rate: 100,
      hours: 24,
      charges: [{ amount: 25 }, { amount: 10 }],
      taxPercent: 0,
    });
    expect(r.charges.toString()).toBe("35");
    expect(r.total.toString()).toBe("135");
  });

  it("clamps discount to gross", () => {
    const r = computeRentalTotals({ pricingModel: "hourly", rate: 100, hours: 2, discount: 500 });
    expect(r.discountAmount.toString()).toBe("200");
    expect(r.total.toString()).toBe("0");
  });

  it("rounds money to 2 decimals", () => {
    const r = computeRentalTotals({ pricingModel: "hourly", rate: 33.33, hours: 3 });
    expect(r.gross.toString()).toBe("99.99");
  });

  it("multiplies gross by quantity", () => {
    const r = computeRentalTotals({ pricingModel: "daily", rate: 100, hours: 48, quantity: 3 });
    expect(r.units).toBe(2);
    expect(r.gross.toString()).toBe("600");
    expect(r.quantity).toBe(3);
    expect(r.total.toString()).toBe("600");
  });

  it("applies discount and tax on quantity-scaled gross", () => {
    const r = computeRentalTotals({
      pricingModel: "daily",
      rate: 100,
      hours: 24,
      quantity: 2,
      discount: 50,
      taxPercent: 10,
    });
    expect(r.gross.toString()).toBe("200");
    expect(r.discountAmount.toString()).toBe("50");
    expect(r.taxable.toString()).toBe("150");
    expect(r.taxAmount.toString()).toBe("15");
    expect(r.total.toString()).toBe("165");
  });

  it("defaults quantity to 1", () => {
    const r = computeRentalTotals({ pricingModel: "hourly", rate: 10, hours: 2 });
    expect(r.quantity).toBe(1);
    expect(r.gross.toString()).toBe("20");
  });

  it("clamps quantity to at least 1", () => {
    const r = computeRentalTotals({ pricingModel: "hourly", rate: 10, hours: 2, quantity: 0 });
    expect(r.quantity).toBe(1);
    expect(r.gross.toString()).toBe("20");
  });
});

describe("computeLateFee", () => {
  const base = { expectedReturnAt: D("2026-01-01T12:00:00"), actualReturnAt: D("2026-01-01T15:00:00") };

  it("returns zero when disabled", () => {
    const r = computeLateFee({ ...base, rule: { enabled: false, graceMinutes: 0, unit: "hourly", ratePerUnit: 50 } });
    expect(r.fee.toString()).toBe("0");
    expect(r.overdueMinutes).toBe(0);
  });

  it("returns zero when returned on time", () => {
    const r = computeLateFee({
      expectedReturnAt: D("2026-01-01T12:00:00"),
      actualReturnAt: D("2026-01-01T11:00:00"),
      rule: { enabled: true, graceMinutes: 0, unit: "hourly", ratePerUnit: 50 },
    });
    expect(r.fee.toString()).toBe("0");
  });

  it("charges per hour with grace", () => {
    const r = computeLateFee({
      ...base,
      rule: { enabled: true, graceMinutes: 30, unit: "hourly", ratePerUnit: 50 },
    });
    expect(r.overdueMinutes).toBe(150);
    expect(r.units).toBe(3);
    expect(r.fee.toString()).toBe("150");
  });

  it("caps the fee when configured", () => {
    const r = computeLateFee({
      ...base,
      rule: { enabled: true, graceMinutes: 0, unit: "hourly", ratePerUnit: 50, capAmount: 100 },
    });
    expect(r.fee.toString()).toBe("100");
  });

  it("charges per day", () => {
    const r = computeLateFee({
      expectedReturnAt: D("2026-01-01T12:00:00"),
      actualReturnAt: D("2026-01-03T12:00:00"),
      rule: { enabled: true, graceMinutes: 0, unit: "daily", ratePerUnit: 200 },
    });
    expect(r.units).toBe(2);
    expect(r.fee.toString()).toBe("400");
  });
});

describe("computeDepositRefund", () => {
  it("refunds held minus deductions", () => {
    const r = computeDepositRefund({ held: 1000, deductions: [{ amount: 150 }, { amount: 50 }] });
    expect(r.totalDeduction.toString()).toBe("200");
    expect(r.refund.toString()).toBe("800");
  });

  it("never refunds below zero", () => {
    const r = computeDepositRefund({ held: 100, deductions: [{ amount: 500 }] });
    expect(r.refund.toString()).toBe("0");
  });
});

describe("computeFuelCharge", () => {
  it("charges only for the shortage below required return level", () => {
    const r = computeFuelCharge({
      fuelAtHandover: 90,
      fuelAtReturn: 60,
      requiredReturnLevel: 80,
      pricePerPercent: 10,
    });
    expect(r.difference).toBe(30);
    expect(r.shortage).toBe(20);
    expect(r.charge.toString()).toBe("200");
  });

  it("no charge when returned at required level", () => {
    const r = computeFuelCharge({
      fuelAtHandover: 90,
      fuelAtReturn: 80,
      requiredReturnLevel: 80,
      pricePerPercent: 10,
    });
    expect(r.shortage).toBe(0);
    expect(r.charge.toString()).toBe("0");
  });
});

describe("Prisma.Decimal interop", () => {
  it("accepts Decimal inputs", () => {
    const r = computeRentalTotals({ pricingModel: "hourly", rate: new Prisma.Decimal("10.50"), hours: 2 });
    expect(r.total.toString()).toBe("21");
  });
});

describe("applyPaymentToLedger", () => {
  const state = (over: Record<string, number> = {}) => ({
    totalAmount: 1000,
    amountPaid: 0,
    depositPaid: 0,
    depositHeld: 0,
    ...over,
  });
  const pay = (s: ReturnType<typeof state>, p: { type: string; amount: number }) =>
    applyPaymentToLedger({ ...s, ...p });

  it("routes deposit cash to depositPaid/depositHeld, not revenue", () => {
    const r = pay(state(), { type: "deposit", amount: 500 });
    expect(r.depositPaid.toString()).toBe("500");
    expect(r.depositHeld.toString()).toBe("500");
    expect(r.amountPaid.toString()).toBe("0");
    expect(r.balance.toString()).toBe("1000"); // revenue untouched
  });

  it("routes rental payments to amountPaid and reduces balance", () => {
    const r = pay(state(), { type: "rental", amount: 400 });
    expect(r.amountPaid.toString()).toBe("400");
    expect(r.balance.toString()).toBe("600");
    expect(r.depositPaid.toString()).toBe("0");
  });

  it("treats late/damage/additional payments as revenue", () => {
    const r = pay(state({ amountPaid: 100 }), { type: "late", amount: 50 });
    expect(r.amountPaid.toString()).toBe("150");
    expect(r.balance.toString()).toBe("850");
  });

  it("reduces amountPaid on refunds without going below zero", () => {
    const r = pay(state({ amountPaid: 100 }), { type: "refund", amount: 300 });
    expect(r.amountPaid.toString()).toBe("0");
    expect(r.balance.toString()).toBe("1000");
  });

  it("keeps deposit custody separate from refunds of revenue", () => {
    let r = applyPaymentToLedger({ totalAmount: 1000, amountPaid: 0, depositPaid: 0, depositHeld: 0, type: "deposit", amount: 500 });
    r = applyPaymentToLedger({ ...r, totalAmount: 1000, type: "rental", amount: 1000 });
    r = applyPaymentToLedger({ ...r, totalAmount: 1000, type: "refund", amount: 200 });
    expect(r.depositPaid.toString()).toBe("500");
    expect(r.depositHeld.toString()).toBe("500");
    expect(r.amountPaid.toString()).toBe("800");
    expect(r.balance.toString()).toBe("200");
  });

  it("rounds to 2 decimals", () => {
    const r = pay(state({ totalAmount: 33.333 }), { type: "rental", amount: 0.005 });
    expect(r.amountPaid.toString()).toBe("0.01");
    expect(r.balance.toString()).toBe("33.32");
  });
});

describe("applyDepositSettlement", () => {
  it("subtracts refund and deductions from held custody", () => {
    const held = applyDepositSettlement({ depositHeld: 500, refund: 300, totalDeduction: 100 });
    expect(held.toString()).toBe("100");
  });

  it("never goes below zero", () => {
    const held = applyDepositSettlement({ depositHeld: 100, refund: 150, totalDeduction: 50 });
    expect(held.toString()).toBe("0");
  });
});
