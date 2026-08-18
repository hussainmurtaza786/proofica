/**
 * Category-specific custom fields ("any rental" universalization).
 *
 * A category can define extra attributes beyond the built-in asset columns
 * (e.g. a camera category can add "Lens mount", a generator can add "Fuel
 * autonomy"). Definitions live on the AssetCategory (`customFieldsJson`) and
 * per-asset values live on the Asset (`customFieldsJson`).
 *
 * Browser-safe: no server-only imports.
 */

export type CustomFieldType = "text" | "number" | "date" | "select" | "boolean";

export type CustomFieldDef = {
  key: string;
  label: string;
  type: CustomFieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
};

export type CustomFieldValues = Record<string, string>;

const VALID_KEYS = /^[a-z0-9_]+$/;

export function slugify(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export function parseCustomFields(raw: string | null | undefined): CustomFieldDef[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCustomFieldDef);
  } catch {
    return [];
  }
}

export function serializeCustomFields(defs: CustomFieldDef[]): string | null {
  const cleaned = defs
    .filter((d) => d.label?.trim() && VALID_KEYS.test(d.key || ""))
    .map((d) => ({
      key: d.key,
      label: d.label.trim(),
      type: d.type,
      required: Boolean(d.required),
      ...(d.placeholder?.trim() ? { placeholder: d.placeholder.trim() } : {}),
      ...(d.type === "select" && d.options?.length ? { options: d.options.map((o) => o.trim()).filter(Boolean) } : {}),
    }));
  return cleaned.length > 0 ? JSON.stringify(cleaned) : null;
}

export function parseCustomFieldValues(raw: string | null | undefined): CustomFieldValues {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as CustomFieldValues;
  } catch {
    return {};
  }
}

export function serializeCustomFieldValues(values: CustomFieldValues): string | null {
  const cleaned: CustomFieldValues = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === "") continue;
    cleaned[key] = String(value);
  }
  return Object.keys(cleaned).length > 0 ? JSON.stringify(cleaned) : null;
}

/**
 * Server-side guard: keeps only values whose keys are declared by the
 * category, normalizes types, and drops malformed numbers. Values that are
 * empty or unknown keys are ignored.
 */
export function sanitizeCustomFieldValues(
  values: Record<string, unknown>,
  defs: CustomFieldDef[]
): CustomFieldValues {
  const out: CustomFieldValues = {};
  for (const def of defs) {
    const raw = values[def.key];
    if (raw === undefined || raw === null || raw === "") continue;
    if (def.type === "boolean") {
      out[def.key] = raw === true || raw === "true" ? "true" : "false";
      continue;
    }
    const str = String(raw);
    if (def.type === "number" && !Number.isFinite(Number(str))) continue;
    out[def.key] = str;
  }
  return out;
}

/** Formats a stored custom field value for display, given its definition. */
export function formatCustomFieldValue(def: CustomFieldDef, value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  const str = String(value);
  if (def.type === "boolean") return str === "true" ? "Yes" : str === "false" ? "No" : str;
  if (def.type === "number") return Number(str).toLocaleString("en-US", { maximumFractionDigits: 2 });
  return str;
}

function isCustomFieldDef(value: unknown): value is CustomFieldDef {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.key === "string" &&
    VALID_KEYS.test(v.key) &&
    typeof v.label === "string" &&
    typeof v.type === "string" &&
    ["text", "number", "date", "select", "boolean"].includes(v.type)
  );
}
