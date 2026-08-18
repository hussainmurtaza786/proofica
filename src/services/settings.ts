import "server-only";

import { prisma } from "@/lib/prisma";

export type RentalRules = {
  roundingRule: "full_unit_per_period" | "calendar_unit";
  lateFeeEnabled: boolean;
  lateFeeGraceMinutes: number;
  lateFeeUnit: "hourly" | "daily";
  lateFeeRate: number;
  lateFeeCap?: number | null;
  depositDeductionAuthThreshold: number;
  fuelRequiredReturnLevel: number;
  fuelPricePerPercent: number;
  returnReminderHours: number;
};

export type InspectionSettings = {
  requireCustomerSignature: boolean;
  requiredPhotoCategories: string[];
};

/**
 * Optional secondary display currency. When configured, money is shown in the
 * org's base currency with an equivalent converted amount alongside it.
 * `displayRate` converts 1 base-currency unit → display-currency units.
 */
export type CurrencySettings = {
  displayCurrency: string | null;
  displayRate: number;
};

const DEFAULT_RENTAL_RULES: RentalRules = {
  roundingRule: "full_unit_per_period",
  lateFeeEnabled: false,
  lateFeeGraceMinutes: 0,
  lateFeeUnit: "hourly",
  lateFeeRate: 0,
  lateFeeCap: null,
  depositDeductionAuthThreshold: 0,
  fuelRequiredReturnLevel: 80,
  fuelPricePerPercent: 0,
  returnReminderHours: 24,
};

const DEFAULT_INSPECTION_SETTINGS: InspectionSettings = {
  requireCustomerSignature: true,
  requiredPhotoCategories: ["front", "rear", "left", "right", "dashboard"],
};

const DEFAULT_CURRENCY_SETTINGS: CurrencySettings = {
  displayCurrency: null,
  displayRate: 0,
};

export async function getOrgSettings(orgId: string) {
  const rows = await prisma.organizationSetting.findMany({
    where: { orgId },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const parse = <T>(key: string, fallback: T): T => {
    const raw = map.get(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  };

  return {
    rentalRules: parse<RentalRules>("rentalRules", DEFAULT_RENTAL_RULES),
    inspectionSettings: parse<InspectionSettings>("inspectionSettings", DEFAULT_INSPECTION_SETTINGS),
    currencySettings: parse<CurrencySettings>("currencySettings", DEFAULT_CURRENCY_SETTINGS),
  };
}

export async function saveOrgSetting(orgId: string, key: string, value: unknown) {
  await prisma.organizationSetting.upsert({
    where: { orgId_key: { orgId, key } },
    create: { orgId, key, value: JSON.stringify(value) },
    update: { value: JSON.stringify(value) },
  });
}
