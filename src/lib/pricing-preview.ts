/**
 * Browser-safe rental price preview. Mirrors `computeRentalTotals` in
 * `src/lib/rental-math.ts` with plain number arithmetic so client forms can
 * show a live estimate. The server action computes the authoritative totals.
 */

export type RoundingRule = "full_unit_per_period" | "calendar_unit";

export function hoursToUnitsPreview(hours: number, pricingModel: string, calendarDays?: number): number {
  switch (pricingModel) {
    case "hourly":
      return Math.max(1, Math.ceil(hours || 0));
    case "daily":
      if (calendarDays && calendarDays >= 1) return Math.max(1, calendarDays);
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

export function previewRentalTotals(input: {
  pricingModel: string;
  rate: number;
  quantity?: number;
  hours: number;
  calendarDays?: number;
  discount?: number;
  taxPercent?: number;
}): { units: number; quantity: number; gross: number; discount: number; taxable: number; tax: number; total: number } {
  const rate = input.rate || 0;
  const quantity = Math.max(1, Math.floor(input.quantity ?? 1));
  const discount = input.discount || 0;
  const taxPercent = input.taxPercent || 0;
  const units = hoursToUnitsPreview(input.hours, input.pricingModel, input.calendarDays);
  const gross = Math.round(rate * units * quantity * 100) / 100;
  const discountAmount = Math.min(discount, gross);
  const taxable = gross - discountAmount;
  const tax = Math.round(taxable * taxPercent) / 100;
  const total = Math.round((taxable + tax) * 100) / 100;
  return { units, quantity, gross, discount: discountAmount, taxable, tax, total };
}

export function previewDurationHours(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return Math.round((b - a) / (1000 * 60 * 60));
}
