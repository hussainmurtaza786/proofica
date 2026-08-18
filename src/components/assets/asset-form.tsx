"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, FolderPlus } from "lucide-react";
import { createAsset } from "@/server/actions/assets";
import { ASSET_STATUSES, ASSET_STATUS_LABELS } from "@/lib/constants";
import { FormField, Input } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseCustomFields, type CustomFieldDef, type CustomFieldValues } from "@/lib/custom-fields";

const OIL_LEVELS = [
  { value: "Full", label: "Full" },
  { value: "3/4", label: "3/4" },
  { value: "Half", label: "Half" },
  { value: "Low", label: "Low" },
  { value: "Empty", label: "Empty" },
];

export function AssetForm({
  categories,
}: {
  categories: { id: string; name: string; kind: string; customFieldsJson: string | null }[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createAsset, { ok: false });
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [customValues, setCustomValues] = useState<CustomFieldValues>({});

  const category = categories.find((c) => c.id === categoryId);
  const fields: CustomFieldDef[] = category ? parseCustomFields(category.customFieldsJson) : [];

  useEffect(() => {
    if (state.redirect) router.push(state.redirect);
    else if (state.ok) router.push("/assets");
  }, [state, router]);

  if (categories.length === 0) {
    return (
      <EmptyState
        icon={FolderPlus}
        title="Create a category first"
        description="Assets need a category before you can add them. Create one to get started."
        actionLabel="Manage Categories"
        href="/assets/categories"
      />
    );
  }

  const setValue = (key: string, value: string) => {
    setCustomValues((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      {state.error && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive ring-1 ring-destructive/20">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {state.error}
        </div>
      )}

      <form
        action={(fd) => {
          fd.set("customFieldsJson", JSON.stringify(customValues));
          return action(fd);
        }}
        className="space-y-6"
      >
        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Basic</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Name" htmlFor="asset-name">
              <Input id="asset-name" name="name" placeholder="e.g. Toyota Corolla 2022" required />
            </FormField>
            <FormField label="Category">
              <SelectField
                name="categoryId"
                defaultValue={categoryId}
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="Select category"
                onValueChange={setCategoryId}
              />
            </FormField>
            <FormField label="Brand" htmlFor="asset-brand">
              <Input id="asset-brand" name="brand" placeholder="e.g. Toyota" />
            </FormField>
            <FormField label="Model" htmlFor="asset-model">
              <Input id="asset-model" name="model" placeholder="e.g. Corolla GLi" />
            </FormField>
            <FormField label="Year" htmlFor="asset-year">
              <Input id="asset-year" name="year" type="number" min={1900} max={2100} placeholder="2022" />
            </FormField>
            <FormField label="Color" htmlFor="asset-color">
              <Input id="asset-color" name="color" placeholder="e.g. White" />
            </FormField>
            <FormField label="Status" className="sm:col-span-2">
              <SelectField
                name="status"
                defaultValue="available"
                options={ASSET_STATUSES.map((s) => ({ value: s, label: ASSET_STATUS_LABELS[s] ?? s }))}
              />
            </FormField>
          </CardContent>
        </Card>

        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Meters & Specs</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Mileage" htmlFor="asset-mileage" hint="Current odometer in km">
              <Input id="asset-mileage" name="mileage" type="number" min={0} step={1} placeholder="0" />
            </FormField>
            <FormField label="Engine Hours" htmlFor="asset-engine-hours">
              <Input id="asset-engine-hours" name="engineHours" type="number" min={0} step={1} placeholder="0" />
            </FormField>
            <FormField label="Fuel Level" htmlFor="asset-fuel-level" hint="Percent 0–100">
              <Input id="asset-fuel-level" name="fuelLevel" type="number" min={0} max={100} step={1} placeholder="100" />
            </FormField>
            <FormField label="Oil Level">
              <SelectField name="oilLevel" options={OIL_LEVELS} placeholder="Select oil level" />
            </FormField>
            <FormField label="Power Output" htmlFor="asset-power-output">
              <Input id="asset-power-output" name="powerOutput" placeholder="e.g. 100 kVA" />
            </FormField>
            <FormField label="Serial Number" htmlFor="asset-serial">
              <Input id="asset-serial" name="serialNumber" placeholder="Optional" />
            </FormField>
            <FormField label="Registration Number" htmlFor="asset-registration">
              <Input id="asset-registration" name="registrationNumber" placeholder="Optional" />
            </FormField>
            <FormField label="VIN" htmlFor="asset-vin">
              <Input id="asset-vin" name="vin" placeholder="Optional" />
            </FormField>
            <FormField label="Engine Number" htmlFor="asset-engine-number">
              <Input id="asset-engine-number" name="engineNumber" placeholder="Optional" />
            </FormField>
          </CardContent>
        </Card>

        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Financials</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Purchase Date" htmlFor="asset-purchase-date">
              <Input id="asset-purchase-date" name="purchaseDate" type="date" />
            </FormField>
            <FormField label="Purchase Price" htmlFor="asset-purchase-price">
              <Input id="asset-purchase-price" name="purchasePrice" type="number" min={0} step="0.01" placeholder="0.00" />
            </FormField>
            <FormField label="Current Value" htmlFor="asset-current-value">
              <Input id="asset-current-value" name="currentValue" type="number" min={0} step="0.01" placeholder="0.00" />
            </FormField>
          </CardContent>
        </Card>

        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Expiries</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Insurance Expiry" htmlFor="asset-insurance-expiry">
              <Input id="asset-insurance-expiry" name="insuranceExpiry" type="date" />
            </FormField>
            <FormField label="Registration Expiry" htmlFor="asset-registration-expiry">
              <Input id="asset-registration-expiry" name="registrationExpiry" type="date" />
            </FormField>
            <FormField label="Inspection Expiry" htmlFor="asset-inspection-expiry">
              <Input id="asset-inspection-expiry" name="inspectionExpiry" type="date" />
            </FormField>
          </CardContent>
        </Card>

        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">More</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Location" htmlFor="asset-location">
              <Input id="asset-location" name="location" placeholder="e.g. Main yard, Karachi" />
            </FormField>
            <FormField label="Description" htmlFor="asset-description">
              <Textarea id="asset-description" name="description" placeholder="Optional" rows={3} />
            </FormField>
            <FormField label="Notes" htmlFor="asset-notes" className="sm:col-span-2">
              <Textarea id="asset-notes" name="notes" placeholder="Internal notes" rows={3} />
            </FormField>
          </CardContent>
        </Card>

        {fields.length > 0 && (
          <Card className="shadow-none border-border">
            <CardHeader>
              <CardTitle className="text-base text-foreground">{category?.name} details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {fields.map((field) => (
                <FormField key={field.key} label={field.label} htmlFor={`cf-${field.key}`} hint={field.placeholder}>
                  {field.type === "select" ? (
                    <SelectField
                      name={`cf-${field.key}`}
                      value={customValues[field.key] ?? ""}
                      onValueChange={(v) => setValue(field.key, v)}
                      options={(field.options ?? []).map((o) => ({ value: o, label: o }))}
                      placeholder="Select…"
                    />
                  ) : field.type === "boolean" ? (
                    <label className="flex items-center gap-2 pt-1 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={customValues[field.key] === "true"}
                        onChange={(e) => setValue(field.key, e.target.checked ? "true" : "false")}
                        className="h-4 w-4 rounded border-border"
                      />
                      {field.required ? "Required" : "Optional"}
                    </label>
                  ) : (
                    <Input
                      id={`cf-${field.key}`}
                      type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                      step={field.type === "number" ? "any" : undefined}
                      value={customValues[field.key] ?? ""}
                      onChange={(e) => setValue(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      required={field.required}
                    />
                  )}
                </FormField>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="flex items-center gap-3">
          <SubmitButton pending={pending}>Save Asset</SubmitButton>
          <Link
            href="/assets"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
