/**
 * Browser-safe money formatting. Safe to import from client components.
 * Values may be Prisma.Decimal instances (serialized as strings by RSC),
 * numbers, or strings.
 */

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  const num = Number(String(value));
  return Number.isFinite(num) ? num : 0;
}

export function formatMoney(
  value: unknown,
  currency: string = "PKR"
): string {
  const num = Math.round(toNumber(value) * 100) / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${currency} ${num.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }
}

/** Convert an amount from the base currency to a display currency using the given rate. */
export function convertAmount(value: unknown, rate: number): number {
  const num = toNumber(value);
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return num * rate;
}

export function formatNumber(value: unknown): string {
  const num = Math.round(toNumber(value) * 100) / 100;
  return num.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
