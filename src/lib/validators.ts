import { z } from "zod";
import {
  ASSET_STATUSES,
  BUSINESS_TYPES,
  CHARGE_TYPES,
  CURRENCIES,
  DAMAGE_CATEGORIES,
  DAMAGE_SEVERITIES,
  DAMAGE_STATUSES,
  DEPOSIT_TXN_TYPES,
  EXPENSE_CATEGORIES,
  MAINTENANCE_TYPES,
  PAYMENT_METHODS,
  PAYMENT_TYPES,
  PRICING_MODELS,
  RENTAL_STATUSES,
} from "@/lib/constants";

// ------------------------------------------------------------
// Auth
// ------------------------------------------------------------

export const registerSchema = z
  .object({
    name: z.string().min(2, "Name is required").max(100),
    email: z.string().email("Invalid email"),
    password: z
      .string()
      .min(12, "Password must be at least 12 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one digit")
      .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
    confirmPassword: z.string(),
    organizationName: z.string().min(2, "Organization name is required"),
    businessType: z.enum(BUSINESS_TYPES).default("Other"),
    currency: z.enum(CURRENCIES).default("PKR"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export const createMemberSchema = z.object({
  email: z.string().email("Invalid email"),
  name: z.string().min(2),
  role: z.enum(["Owner", "Admin", "Manager", "Staff", "Inspector", "Accountant"]),
  password: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one digit")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
});

// ------------------------------------------------------------
// Customers
// ------------------------------------------------------------

const optionalDate = z.string().optional().nullable();

export const customerSchema = z.object({
  name: z.string().min(2, "Name is required").max(120),
  phone: z.string().min(5, "Phone is required"),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  country: z.string().optional().or(z.literal("")),
  idType: z.string().optional().or(z.literal("")),
  idNumber: z.string().optional().or(z.literal("")),
  idExpiry: optionalDate,
  licenseNumber: z.string().optional().or(z.literal("")),
  licenseExpiry: optionalDate,
  emergencyContactName: z.string().optional().or(z.literal("")),
  emergencyContactPhone: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

// ------------------------------------------------------------
// Assets
// ------------------------------------------------------------

export const assetSchema = z.object({
  name: z.string().min(2, "Name is required").max(120),
  categoryId: z.string().min(1, "Category is required"),
  brand: z.string().optional().or(z.literal("")),
  model: z.string().optional().or(z.literal("")),
  serialNumber: z.string().optional().or(z.literal("")),
  registrationNumber: z.string().optional().or(z.literal("")),
  vin: z.string().optional().or(z.literal("")),
  engineNumber: z.string().optional().or(z.literal("")),
  year: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
  color: z.string().optional().or(z.literal("")),
  mileage: z.coerce.number().int().min(0).optional().nullable(),
  engineHours: z.coerce.number().int().min(0).optional().nullable(),
  fuelLevel: z.coerce.number().int().min(0).max(100).optional().nullable(),
  oilLevel: z.string().optional().or(z.literal("")),
  powerOutput: z.string().optional().or(z.literal("")),
  location: z.string().optional().or(z.literal("")),
  purchaseDate: optionalDate,
  purchasePrice: z.coerce.number().min(0).optional().nullable(),
  currentValue: z.coerce.number().min(0).optional().nullable(),
  insuranceExpiry: optionalDate,
  registrationExpiry: optionalDate,
  inspectionExpiry: optionalDate,
  description: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  status: z.enum(ASSET_STATUSES).default("available"),
  customFieldsJson: z.string().optional().or(z.literal("")),
});

export const customFieldSchema = z.object({
  key: z.string().min(1).regex(/^[a-z0-9_]+$/, "Field key must be lowercase letters, numbers or underscores"),
  label: z.string().min(1, "Field label is required"),
  type: z.enum(["text", "number", "date", "select", "boolean"]).default("text"),
  required: z.boolean().default(false),
  placeholder: z.string().optional().or(z.literal("")),
  options: z.array(z.string()).optional().default([]),
});

export const categorySchema = z.object({
  name: z.string().min(2, "Name is required"),
  kind: z.enum(["vehicle", "generator", "equipment", "tool", "electronics", "other"]).default("equipment"),
  description: z.string().optional().or(z.literal("")),
  customFields: z.array(customFieldSchema).default([]),
});

// ------------------------------------------------------------
// Rentals
// ------------------------------------------------------------

export const rentalSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  assetId: z.string().min(1, "Asset is required"),
  startAt: z.string().min(1, "Start date is required"),
  expectedReturnAt: z.string().min(1, "Return date is required"),
  pricingModel: z.enum(PRICING_MODELS).default("daily"),
  rate: z.coerce.number().min(0).default(0),
  quantity: z.coerce.number().int().min(1).default(1),
  depositRequired: z.coerce.number().min(0).default(0),
  discount: z.coerce.number().min(0).default(0),
  taxPercent: z.coerce.number().min(0).max(100).default(0),
  notes: z.string().optional().or(z.literal("")),
});

export const rentalChargeSchema = z.object({
  rentalId: z.string().min(1),
  type: z.enum(CHARGE_TYPES),
  description: z.string().min(2, "Description is required"),
  amount: z.coerce.number().min(0),
  qty: z.coerce.number().min(1).default(1),
  reason: z.string().optional().or(z.literal("")),
});

export const extensionSchema = z.object({
  rentalId: z.string().min(1),
  toAt: z.string().min(1, "New return date is required"),
  additionalCost: z.coerce.number().min(0),
  additionalDeposit: z.coerce.number().min(0).default(0),
});

export const rentalStatusChangeSchema = z.object({
  rentalId: z.string().min(1),
  status: z.enum(RENTAL_STATUSES),
});

// ------------------------------------------------------------
// Payments / deposits
// ------------------------------------------------------------

export const paymentSchema = z.object({
  rentalId: z.string().min(1),
  amount: z.coerce.number().positive("Amount must be positive"),
  method: z.enum(PAYMENT_METHODS).default("cash"),
  type: z.enum(PAYMENT_TYPES).default("rental"),
  reference: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  receivedAt: z.string().optional(),
});

export const depositRefundSchema = z.object({
  depositId: z.string().min(1),
  deductions: z
    .array(
      z.object({
        amount: z.coerce.number().min(0),
        reason: z.string().min(2, "Reason is required for every deduction"),
      })
    )
    .min(0),
});

export const depositTxnSchema = z.object({
  depositId: z.string().min(1),
  type: z.enum(DEPOSIT_TXN_TYPES),
  amount: z.coerce.number().min(0),
  reason: z.string().optional().or(z.literal("")),
});

// ------------------------------------------------------------
// Inspections
// ------------------------------------------------------------

export const inspectionMeterSchema = z.object({
  inspectionId: z.string().min(1),
  mileage: z.coerce.number().int().min(0).optional().nullable(),
  engineHours: z.coerce.number().int().min(0).optional().nullable(),
  fuelLevel: z.coerce.number().int().min(0).max(100).optional().nullable(),
  oilLevel: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export const inspectionItemSchema = z.object({
  inspectionId: z.string().min(1),
  items: z.array(
    z.object({
      id: z.string().optional(),
      label: z.string().min(1),
      section: z.string().min(1),
      category: z.string().optional(),
      beforeValue: z.string().optional().or(z.literal("")),
      afterValue: z.string().optional().or(z.literal("")),
      status: z.enum(["ok", "issue", "na", "missing"]).default("ok"),
      notes: z.string().optional().or(z.literal("")),
      sortOrder: z.number().int().default(0),
    })
  ),
});

export const inspectionDamageSchema = z.object({
  inspectionId: z.string().min(1),
  damages: z.array(
    z.object({
      id: z.string().optional(),
      category: z.enum(DAMAGE_CATEGORIES).default("other"),
      location: z.string().optional().or(z.literal("")),
      description: z.string().min(2, "Description is required"),
      severity: z.enum(DAMAGE_SEVERITIES).default("minor"),
      estimatedRepairCost: z.coerce.number().min(0).default(0),
      positionX: z.coerce.number().optional().nullable(),
      positionY: z.coerce.number().optional().nullable(),
      isPreExisting: z.boolean().default(false),
    })
  ),
});

export const inspectionSignatureSchema = z.object({
  inspectionId: z.string().min(1),
  role: z.enum(["customer", "staff"]),
  name: z.string().min(1, "Signatory name is required"),
  dataUrl: z.string().min(50, "Signature is required"),
});

export const inspectionCompleteSchema = z.object({
  inspectionId: z.string().min(1),
});

// ------------------------------------------------------------
// Expenses / budgets / maintenance
// ------------------------------------------------------------

export const expenseSchema = z.object({
  assetId: z.string().optional().or(z.literal("")),
  category: z.enum(EXPENSE_CATEGORIES).default("other"),
  amount: z.coerce.number().positive("Amount must be positive"),
  date: z.string().min(1),
  vendor: z.string().optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
});

export const budgetSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  period: z.enum(["monthly", "yearly"]).default("monthly"),
  amount: z.coerce.number().positive(),
  month: z.coerce.number().int().min(1).max(12).optional().nullable(),
  year: z.coerce.number().int().min(2000).max(2100),
  threshold: z.coerce.number().min(1).max(100).default(85),
});

export const maintenanceSchema = z.object({
  assetId: z.string().min(1, "Asset is required"),
  type: z.enum(MAINTENANCE_TYPES).default("general"),
  date: z.string().min(1),
  cost: z.coerce.number().min(0).default(0),
  vendor: z.string().optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
  mileage: z.coerce.number().int().min(0).optional().nullable(),
  engineHours: z.coerce.number().int().min(0).optional().nullable(),
  nextDate: z.string().optional().or(z.literal("")),
  nextMileage: z.coerce.number().int().min(0).optional().nullable(),
  status: z.enum(["scheduled", "in_progress", "completed", "overdue"]).default("scheduled"),
});

// ------------------------------------------------------------
// Settings / org
// ------------------------------------------------------------

export const orgSettingsSchema = z.object({
  name: z.string().min(2),
  businessType: z.string().min(1),
  currency: z.enum(CURRENCIES),
  timezone: z.string().min(1),
  address: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
});

export const rentalRulesSchema = z.object({
  roundingRule: z.enum(["full_unit_per_period", "calendar_unit"]).default("full_unit_per_period"),
  lateFeeEnabled: z.boolean().default(false),
  lateFeeGraceMinutes: z.coerce.number().int().min(0).default(0),
  lateFeeUnit: z.enum(["hourly", "daily"]).default("hourly"),
  lateFeeRate: z.coerce.number().min(0).default(0),
  lateFeeCap: z.coerce.number().min(0).optional().nullable(),
  depositDeductionAuthThreshold: z.coerce.number().min(0).default(0),
  fuelRequiredReturnLevel: z.coerce.number().int().min(0).max(100).default(80),
  fuelPricePerPercent: z.coerce.number().min(0).default(0),
  returnReminderHours: z.coerce.number().int().min(0).default(24),
});

export const inspectionSettingsSchema = z.object({
  requireCustomerSignature: z.boolean().default(true),
  requiredPhotoCategories: z.array(z.string()),
});

export const currencySettingsSchema = z.object({
  displayCurrency: z.enum(CURRENCIES).optional().nullable().default(null),
  displayRate: z.coerce.number().min(0).default(0),
});
