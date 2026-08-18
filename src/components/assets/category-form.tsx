"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Plus, Trash2 } from "lucide-react";
import { createCategory } from "@/server/actions/assets";
import { ASSET_KINDS, KIND_LABELS, type AssetKind } from "@/lib/constants";
import { FormField, Input } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { slugify, type CustomFieldDef, type CustomFieldType } from "@/lib/custom-fields";

type ActionResult = { ok: boolean; error?: string; message?: string; redirect?: string };

const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown" },
  { value: "boolean", label: "Yes / No" },
];

function emptyField(): CustomFieldDef {
  return { key: "", label: "", type: "text", required: false, options: [] };
}

export function CategoryForm({ allowedKinds }: { allowedKinds?: readonly AssetKind[] }) {
  const router = useRouter();
  const [fields, setFields] = useState<CustomFieldDef[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [redirect, setRedirect] = useState<string | undefined>();

  useEffect(() => {
    if (redirect) router.push(redirect);
  }, [redirect, router]);

  const submit = async (fd: FormData) => {
    fd.set("customFields", JSON.stringify(fields));
    setPending(true);
    setError(undefined);
    const res: ActionResult = await createCategory({ ok: false }, fd);
    setPending(false);
    if (res.redirect) setRedirect(res.redirect);
    else if (res.ok) {
      router.refresh();
      setFields([]);
    } else setError(res.error ?? "Something went wrong");
  };

  const updateField = (index: number, patch: Partial<CustomFieldDef>) => {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  };

  return (
    <div>
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive ring-1 ring-destructive/20">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      <form action={submit} className="space-y-4">
        <FormField label="Name" htmlFor="category-name">
          <Input id="category-name" name="name" placeholder="e.g. Sedans" required />
        </FormField>
        <FormField label="Kind">
          <SelectField
            name="kind"
            defaultValue="equipment"
            options={(allowedKinds ?? ASSET_KINDS).map((k) => ({ value: k, label: KIND_LABELS[k] ?? k }))}
          />
        </FormField>
        <FormField label="Description" htmlFor="category-description">
          <Input id="category-description" name="description" placeholder="Optional" />
        </FormField>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Custom fields</p>
            <button
              type="button"
              onClick={() => setFields((prev) => [...prev, emptyField()])}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:border-border hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5" /> Add field
            </button>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Extra attributes for assets in this category (e.g. a camera&apos;s lens mount, a generator&apos;s fuel autonomy).
          </p>

          {fields.length === 0 && (
            <p className="rounded-lg border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">
              No custom fields yet.
            </p>
          )}

          <div className="space-y-3">
            {fields.map((field, i) => (
              <div key={i} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Field {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => setFields((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-muted-foreground hover:text-red-500 dark:hover:text-red-400"
                    aria-label="Remove field"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField label="Label" htmlFor={`cf-label-${i}`}>
                    <Input
                      id={`cf-label-${i}`}
                      value={field.label}
                      onChange={(e) =>
                        updateField(i, { label: e.target.value, key: field.key || slugify(e.target.value) })
                      }
                      placeholder="e.g. Lens mount"
                    />
                  </FormField>
                  <FormField label="Key" htmlFor={`cf-key-${i}`} hint="Auto-generated, used internally">
                    <Input
                      id={`cf-key-${i}`}
                      value={field.key}
                      onChange={(e) => updateField(i, { key: slugify(e.target.value) })}
                      placeholder="e.g. lens_mount"
                      readOnly
                      className="bg-muted text-muted-foreground"
                    />
                  </FormField>
                  <FormField label="Type">
                    <SelectField
                      value={field.type}
                      onValueChange={(v) => updateField(i, { type: v as CustomFieldType })}
                      options={FIELD_TYPES}
                    />
                  </FormField>
                  {field.type === "select" && (
                    <FormField label="Options" htmlFor={`cf-options-${i}`} hint="Comma separated">
                      <Input
                        id={`cf-options-${i}`}
                        value={(field.options ?? []).join(", ")}
                        onChange={(e) =>
                          updateField(i, {
                            options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean),
                          })
                        }
                        placeholder="Canon, Nikon, Sony"
                      />
                    </FormField>
                  )}
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={field.required ?? false}
                      onChange={(e) => updateField(i, { required: e.target.checked })}
                      className="h-4 w-4 rounded border-border"
                    />
                    Required
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        <SubmitButton pending={pending} className="w-full">
          Create Category
        </SubmitButton>
      </form>
    </div>
  );
}
