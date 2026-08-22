export const CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "PKR",
  "INR",
  "AED",
  "SAR",
  "QAR",
  "KWD",
  "BHD",
  "OMR",
  "TRY",
  "EGP",
  "MAD",
  "NGN",
  "KES",
  "GHS",
  "ZAR",
  "BDT",
  "LKR",
  "IDR",
  "MYR",
  "SGD",
  "CNY",
  "JPY",
  "AUD",
  "CAD",
  "NZD",
  "CHF",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "BRL",
  "MXN",
  "COP",
  "PHP",
  "THB",
  "VND",
  "KRW",
] as const;
export type Currency = (typeof CURRENCIES)[number];

export const BUSINESS_TYPES = [
  "Car Rental",
  "Generator Rental",
  "Equipment Rental",
  "Tool Rental",
  "Electronics Rental",
  "Construction Equipment",
  "Event Equipment",
  "Other",
] as const;

export const ASSET_KINDS = ["vehicle", "generator", "equipment", "tool", "electronics", "other"] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export const KIND_LABELS: Record<string, string> = {
  vehicle: "Vehicle",
  generator: "Generator",
  equipment: "Equipment",
  tool: "Tool",
  electronics: "Electronics",
  other: "Other",
};

/** Maps each business type to the asset kinds that are relevant for it. */
export const BUSINESS_TYPE_KINDS: Record<string, readonly AssetKind[]> = {
  "Car Rental": ["vehicle"],
  "Generator Rental": ["generator"],
  "Equipment Rental": ["equipment"],
  "Tool Rental": ["tool"],
  "Electronics Rental": ["electronics"],
  "Construction Equipment": ["equipment", "tool"],
  "Event Equipment": ["equipment"],
  "Other": [...ASSET_KINDS],
};

/** Returns the allowed asset kinds for a given business type. Falls back to all kinds. */
export function getAllowedKinds(businessType: string): readonly AssetKind[] {
  return BUSINESS_TYPE_KINDS[businessType] ?? ASSET_KINDS;
}

export const ASSET_STATUSES = [
  "available",
  "reserved",
  "rented",
  "inspection",
  "maintenance",
  "damaged",
  "lost",
  "retired",
] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const ASSET_STATUS_LABELS: Record<string, string> = {
  available: "Available",
  reserved: "Reserved",
  rented: "Rented",
  inspection: "Inspection",
  maintenance: "Maintenance",
  damaged: "Damaged",
  lost: "Lost",
  retired: "Retired",
};

export const RENTAL_STATUSES = [
  "draft",
  "reserved",
  "awaiting_handover",
  "active",
  "due_soon",
  "overdue",
  "returned",
  "inspection_pending",
  "completed",
  "cancelled",
  "disputed",
] as const;
export type RentalStatus = (typeof RENTAL_STATUSES)[number];

export const RENTAL_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  reserved: "Reserved",
  awaiting_handover: "Awaiting Handover",
  active: "Active",
  due_soon: "Due Soon",
  overdue: "Overdue",
  returned: "Returned",
  inspection_pending: "Inspection Pending",
  completed: "Completed",
  cancelled: "Cancelled",
  disputed: "Disputed",
};

export const PRICING_MODELS = ["hourly", "daily", "weekly", "monthly", "custom"] as const;
export type PricingModel = (typeof PRICING_MODELS)[number];

export const PRICING_MODEL_LABELS: Record<string, string> = {
  hourly: "Hourly",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  custom: "Custom",
};

export const PAYMENT_METHODS = ["cash", "bank_transfer", "card", "online", "other"] as const;

export const PAYMENT_TYPES = ["rental", "deposit", "refund", "late", "damage", "additional"] as const;

export const DEPOSIT_STATUSES = ["pending", "held", "partially_returned", "returned", "deducted", "forfeited"] as const;

export const DEPOSIT_TXN_TYPES = ["received", "refunded", "deducted", "forfeited"] as const;

export const CHARGE_TYPES = [
  "late",
  "damage",
  "fuel",
  "mileage",
  "cleaning",
  "delivery",
  "pickup",
  "missing",
  "custom",
] as const;

export const DAMAGE_SEVERITIES = ["cosmetic", "minor", "moderate", "major", "critical"] as const;

export const DAMAGE_STATUSES = [
  "reported",
  "under_review",
  "customer_disputed",
  "approved",
  "repair_pending",
  "repairing",
  "resolved",
  "rejected",
] as const;

export const DAMAGE_CATEGORIES = ["scratch", "dent", "crack", "broken", "missing", "fuel", "other"] as const;

export const INSPECTION_SECTIONS = ["meter", "exterior", "interior", "functional", "accessory", "consumable", "notes"] as const;

export const EXPENSE_CATEGORIES = [
  "fuel",
  "repairs",
  "maintenance",
  "insurance",
  "registration",
  "cleaning",
  "parts",
  "staff",
  "transport",
  "other",
] as const;

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  fuel: "Fuel",
  repairs: "Repairs",
  maintenance: "Maintenance",
  insurance: "Insurance",
  registration: "Registration",
  cleaning: "Cleaning",
  parts: "Parts",
  staff: "Staff",
  transport: "Transportation",
  other: "Miscellaneous",
};

export const MAINTENANCE_TYPES = [
  "oil_change",
  "tires",
  "brakes",
  "engine",
  "electrical",
  "cleaning",
  "general",
  "inspection",
  "other",
] as const;

export const MAINTENANCE_TYPE_LABELS: Record<string, string> = {
  oil_change: "Oil Change",
  tires: "Tires",
  brakes: "Brakes",
  engine: "Engine",
  electrical: "Electrical",
  cleaning: "Cleaning",
  general: "General Service",
  inspection: "Inspection",
  other: "Other",
};

export const NOTIFICATION_TYPES = [
  "rental_due",
  "rental_overdue",
  "payment_overdue",
  "payment_received",
  "deposit_pending",
  "inspection_pending",
  "damage_detected",
  "maintenance_due",
  "document_expiry",
  "budget_threshold",
  "new_customer",
  "rental_extension",
] as const;

// ------------------------------------------------------------
// Roles & permissions (centralized RBAC)
// ------------------------------------------------------------

export const ROLES = ["Owner", "Admin", "Manager", "Staff", "Inspector", "Accountant"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = {
  manageOrganization: "manageOrganization",
  manageUsers: "manageUsers",
  manageBilling: "manageBilling",
  manageSettings: "manageSettings",
  manageRoles: "manageRoles",
  manageAssets: "manageAssets",
  createAsset: "createAsset",
  manageCustomers: "manageCustomers",
  createCustomer: "createCustomer",
  manageRentals: "manageRentals",
  createRental: "createRental",
  cancelRental: "cancelRental",
  performInspection: "performInspection",
  finalizeInspection: "finalizeInspection",
  manageDamage: "manageDamage",
  recordPayment: "recordPayment",
  approveDepositDeduction: "approveDepositDeduction",
  manageExpenses: "manageExpenses",
  viewFinancials: "viewFinancials",
  viewReports: "viewReports",
  viewAuditLogs: "viewAuditLogs",
  manageMaintenance: "manageMaintenance",
  manageBudgets: "manageBudgets",
  manageDisputes: "manageDisputes",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ALL: Permission[] = Object.values(PERMISSIONS);

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  Owner: ALL,
  Admin: ALL.filter((p) => p !== PERMISSIONS.manageBilling),
  Manager: [
    PERMISSIONS.manageAssets,
    PERMISSIONS.createAsset,
    PERMISSIONS.manageCustomers,
    PERMISSIONS.createCustomer,
    PERMISSIONS.manageRentals,
    PERMISSIONS.createRental,
    PERMISSIONS.cancelRental,
    PERMISSIONS.performInspection,
    PERMISSIONS.finalizeInspection,
    PERMISSIONS.manageDamage,
    PERMISSIONS.recordPayment,
    PERMISSIONS.approveDepositDeduction,
    PERMISSIONS.manageExpenses,
    PERMISSIONS.viewFinancials,
    PERMISSIONS.viewReports,
    PERMISSIONS.manageMaintenance,
    PERMISSIONS.manageBudgets,
    PERMISSIONS.manageDisputes,
  ],
  Staff: [
    PERMISSIONS.createCustomer,
    PERMISSIONS.createRental,
    PERMISSIONS.performInspection,
    PERMISSIONS.recordPayment,
    PERMISSIONS.manageMaintenance,
  ],
  Inspector: [PERMISSIONS.performInspection, PERMISSIONS.manageDamage],
  Accountant: [
    PERMISSIONS.recordPayment,
    PERMISSIONS.manageExpenses,
    PERMISSIONS.viewFinancials,
    PERMISSIONS.viewReports,
  ],
};

export function roleHasPermission(role: string, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role as Role] ?? [];
  return perms.includes(permission);
}

export function roleCanAccessModule(role: string, module: string): boolean {
  switch (module) {
    case "dashboard":
      return true;
    case "rentals":
      return roleHasPermission(role, PERMISSIONS.manageRentals) || roleHasPermission(role, PERMISSIONS.createRental);
    case "assets":
      return roleHasPermission(role, PERMISSIONS.manageAssets) || roleHasPermission(role, PERMISSIONS.createAsset);
    case "customers":
      return roleHasPermission(role, PERMISSIONS.manageCustomers) || roleHasPermission(role, PERMISSIONS.createCustomer);
    case "inspections":
      return roleHasPermission(role, PERMISSIONS.performInspection);
    case "payments":
      return roleHasPermission(role, PERMISSIONS.recordPayment) || roleHasPermission(role, PERMISSIONS.viewFinancials);
    case "expenses":
      return roleHasPermission(role, PERMISSIONS.manageExpenses) || roleHasPermission(role, PERMISSIONS.viewFinancials);
    case "budgets":
      return roleHasPermission(role, PERMISSIONS.manageBudgets) || roleHasPermission(role, PERMISSIONS.viewFinancials);
    case "maintenance":
      return roleHasPermission(role, PERMISSIONS.manageMaintenance);
    case "reports":
      return roleHasPermission(role, PERMISSIONS.viewReports);
    case "settings":
      return roleHasPermission(role, PERMISSIONS.manageSettings) || roleHasPermission(role, PERMISSIONS.manageUsers);
    default:
      return false;
  }
}

// Money helpers moved to `@/lib/decimal` (server-only) so this module can be
// imported from client components without pulling in the Prisma runtime.
