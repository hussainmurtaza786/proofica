import {
  differenceInHours,
  differenceInCalendarDays,
  addHours,
  isAfter,
} from "date-fns";
import { Prisma } from "@prisma/client";

// ------------------------------------------------------------
// Pure business math for rentals. No I/O — unit-testable.
// ------------------------------------------------------------

export type RoundingRule = "full_unit_per_period" | "calendar_unit";

export function computeDurationHours(startAt: Date, endAt: Date): number {
  return Math.max(0, differenceInHours(endAt, startAt));
}

/**
 * Converts hours to pricing units based on the model.
 * - hourly  -> hours
 * - daily   -> days (ceil by default, or calendar days)
 * - weekly  -> weeks
 * - monthly -> months
 * - custom  -> 1 (flat)
 */
export function hoursToUnits(
  hours: number,
  pricingModel: string,
  rounding: RoundingRule = "full_unit_per_period",
  calendarDays?: number
): number {
  switch (pricingModel) {
    case "hourly":
      return Math.max(1, Math.ceil(hours || 0));
    case "daily":
      if (rounding === "calendar_unit" && calendarDays) return Math.max(1, calendarDays);
      return Math.max(1, Math.ceil((hours || 0) / 24));
    case "weekly":
      return Math.max(1, Math.ceil((hours || 0) / 168));
    case "monthly":
      return Math.max(1, Math.ceil((hours || 0) / 730));
    case "custom":
    default:
      return 1;
  }
}

export type PriceBreakdown = {
  gross: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  charges: Prisma.Decimal;
  taxable: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  total: Prisma.Decimal;
  units: number;
  quantity: number;
  hours: number;
};

/**
 * Computes a deterministic rental price breakdown.
 * total = (gross + charges - discount) * (1 + taxPercent/100)
 */
export function computeRentalTotals(input: {
  pricingModel: string;
  rate: Prisma.Decimal | number | string;
  quantity?: number;
  hours: number;
  calendarDays?: number;
  discount?: Prisma.Decimal | number | string;
  taxPercent?: Prisma.Decimal | number | string;
  charges?: { amount: Prisma.Decimal | number | string }[];
  rounding?: RoundingRule;
}): PriceBreakdown {
  const rate = new Prisma.Decimal(input.rate.toString() || "0");
  const quantity = Math.max(1, Math.floor(input.quantity ?? 1));
  const discount = new Prisma.Decimal((input.discount?.toString() ?? "0") || "0");
  const taxPercent = new Prisma.Decimal((input.taxPercent?.toString() ?? "0") || "0");
  const chargesTotal = (input.charges ?? []).reduce(
    (acc, c) => acc.add(new Prisma.Decimal(c.amount.toString() || "0")),
    new Prisma.Decimal(0)
  );

  const units = hoursToUnits(input.hours, input.pricingModel, input.rounding, input.calendarDays);
  const gross = rate.mul(units).mul(quantity);

  const discountAmount = Prisma.Decimal.min(discount, gross).toDecimalPlaces(2);
  const taxable = gross.add(chargesTotal).sub(discountAmount);
  const taxAmount = taxable.mul(taxPercent).div(100).toDecimalPlaces(2);
  const total = taxable.add(taxAmount).toDecimalPlaces(2);

  return {
    gross: gross.toDecimalPlaces(2),
    discountAmount,
    charges: chargesTotal.toDecimalPlaces(2),
    taxable: taxable.toDecimalPlaces(2),
    taxAmount,
    total,
    units,
    quantity,
    hours: Math.round(input.hours),
  };
}

export type LateFeeRule = {
  enabled: boolean;
  graceMinutes: number;
  unit: "hourly" | "daily";
  ratePerUnit: Prisma.Decimal | number | string;
  capAmount?: Prisma.Decimal | number | string;
};

/**
 * Calculates late fees for a rental returned after the expected time.
 * fees = overdueUnits * ratePerUnit, capped at capAmount when set.
 */
export function computeLateFee(input: {
  expectedReturnAt: Date;
  actualReturnAt: Date;
  rule: LateFeeRule;
}): { overdueMinutes: number; units: number; fee: Prisma.Decimal } {
  const rule = input.rule;
  if (!rule.enabled) {
    return { overdueMinutes: 0, units: 0, fee: new Prisma.Decimal(0) };
  }
  if (!isAfter(input.actualReturnAt, input.expectedReturnAt)) {
    return { overdueMinutes: 0, units: 0, fee: new Prisma.Decimal(0) };
  }

  const rawMinutes = Math.max(
    0,
    differenceInHours(input.actualReturnAt, input.expectedReturnAt) * 60
  );
  const overdueMinutes = Math.max(0, rawMinutes - (rule.graceMinutes || 0));
  if (overdueMinutes === 0) {
    return { overdueMinutes: 0, units: 0, fee: new Prisma.Decimal(0) };
  }

  const units =
    rule.unit === "hourly"
      ? Math.ceil(overdueMinutes / 60)
      : Math.ceil(overdueMinutes / (24 * 60));

  let fee = new Prisma.Decimal(rule.ratePerUnit.toString() || "0").mul(units).toDecimalPlaces(2);
  if (rule.capAmount) {
    const cap = new Prisma.Decimal(rule.capAmount.toString());
    fee = Prisma.Decimal.min(fee, cap);
  }
  return { overdueMinutes, units, fee };
}

/**
 * Deposit refund math: held amount minus approved deductions.
 * Deductions are always linked to a reason.
 */
export function computeDepositRefund(input: {
  held: Prisma.Decimal | number | string;
  deductions: { amount: Prisma.Decimal | number | string }[];
}): { totalDeduction: Prisma.Decimal; refund: Prisma.Decimal } {
  const held = new Prisma.Decimal(input.held.toString() || "0");
  const totalDeduction = input.deductions.reduce(
    (acc, d) => acc.add(new Prisma.Decimal(d.amount.toString() || "0")),
    new Prisma.Decimal(0)
  );
  const refund = Prisma.Decimal.max(held.sub(totalDeduction), new Prisma.Decimal(0)).toDecimalPlaces(2);
  return { totalDeduction: totalDeduction.toDecimalPlaces(2), refund };
}

// ------------------------------------------------------------
// Ledger rules. Deposits are tracked separately from rental
// revenue: `amountPaid`/`balance` never include deposit cash.
// ------------------------------------------------------------

const dec = (v: Prisma.Decimal | number | string) =>
  v instanceof Prisma.Decimal ? v : new Prisma.Decimal(v.toString() || "0");

/**
 * Applies a recorded payment to the rental ledger.
 * - deposit -> depositPaid/depositHeld grow; revenue untouched
 * - refund  -> amountPaid shrinks (floored at zero), balance grows
 * - other   -> amountPaid grows, balance recomputed against totalAmount
 */
export function applyPaymentToLedger(input: {
  totalAmount: Prisma.Decimal | number | string;
  amountPaid: Prisma.Decimal | number | string;
  depositPaid: Prisma.Decimal | number | string;
  depositHeld: Prisma.Decimal | number | string;
  type: string;
  amount: Prisma.Decimal | number | string;
}): { amountPaid: Prisma.Decimal; balance: Prisma.Decimal; depositPaid: Prisma.Decimal; depositHeld: Prisma.Decimal } {
  const totalAmount = dec(input.totalAmount);
  let amountPaid = dec(input.amountPaid);
  let depositPaid = dec(input.depositPaid);
  let depositHeld = dec(input.depositHeld);
  const amount = dec(input.amount);

  if (input.type === "deposit") {
    depositPaid = depositPaid.add(amount);
    depositHeld = depositHeld.add(amount);
  } else if (input.type === "refund") {
    amountPaid = Prisma.Decimal.max(amountPaid.sub(amount), new Prisma.Decimal(0));
  } else {
    amountPaid = amountPaid.add(amount);
  }
  amountPaid = amountPaid.toDecimalPlaces(2);

  const balance = totalAmount.sub(amountPaid).toDecimalPlaces(2);
  return {
    amountPaid,
    balance,
    depositPaid: depositPaid.toDecimalPlaces(2),
    depositHeld: depositHeld.toDecimalPlaces(2),
  };
}

/**
 * Settles the deposit pool after finalization: both refunds and deductions
 * release funds from custody. Never goes below zero.
 */
export function applyDepositSettlement(input: {
  depositHeld: Prisma.Decimal | number | string;
  refund: Prisma.Decimal | number | string;
  totalDeduction: Prisma.Decimal | number | string;
}): Prisma.Decimal {
  const held = dec(input.depositHeld)
    .sub(dec(input.refund))
    .sub(dec(input.totalDeduction));
  return Prisma.Decimal.max(held, new Prisma.Decimal(0)).toDecimalPlaces(2);
}

/**
 * Fuel / consumable charge: difference between configured return level and
 * actual return level, priced per percent.
 */
export function computeFuelCharge(input: {
  fuelAtHandover: number | null;
  fuelAtReturn: number | null;
  requiredReturnLevel: number; // percent
  pricePerPercent: Prisma.Decimal | number | string;
}): { difference: number; shortage: number; charge: Prisma.Decimal } {
  const before = input.fuelAtHandover ?? 0;
  const after = input.fuelAtReturn ?? 0;
  const difference = before - after;
  const shortage = Math.max(0, input.requiredReturnLevel - after);
  const charge = new Prisma.Decimal(input.pricePerPercent.toString() || "0")
    .mul(shortage)
    .toDecimalPlaces(2);
  return { difference, shortage, charge };
}

export { differenceInCalendarDays, addHours };
