import "server-only";

import { Prisma } from "@prisma/client";

/**
 * Server-only money helpers. Never import this module from a client component:
 * the generated Prisma client pulls in the Node.js runtime (node:module, node:fs).
 * Use the browser-safe formatters in `@/lib/money` for display instead.
 */

export function toDecimal(value: number | string | Prisma.Decimal): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) return value;
  return new Prisma.Decimal(Number(value) || 0).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function sumDecimal(values: (Prisma.Decimal | null | undefined)[]): Prisma.Decimal {
  return values
    .reduce<Prisma.Decimal>((acc, v) => acc.add(v ?? new Prisma.Decimal(0)), new Prisma.Decimal(0))
    .toDecimalPlaces(2);
}

export const money = {
  add: (a: Prisma.Decimal | number, b: Prisma.Decimal | number) => new Prisma.Decimal(a).add(b).toDecimalPlaces(2),
  sub: (a: Prisma.Decimal | number, b: Prisma.Decimal | number) => new Prisma.Decimal(a).sub(b).toDecimalPlaces(2),
  mul: (a: Prisma.Decimal | number, b: Prisma.Decimal | number) => new Prisma.Decimal(a).mul(b).toDecimalPlaces(2),
  div: (a: Prisma.Decimal | number, b: Prisma.Decimal | number) => new Prisma.Decimal(a).div(b).toDecimalPlaces(2),
  zero: () => new Prisma.Decimal(0),
};
