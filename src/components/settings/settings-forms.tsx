"use client";

import { useState } from "react";
import { AlertCircle, Check } from "lucide-react";
import { toast } from "sonner";
import {
  updateOrganization,
  updateRentalRules,
  updateInspectionSettings,
  updateCurrencySettings,
  addTeamMember,
} from "@/server/actions/settings";
import { SubmitButton } from "@/components/shared/submit-button";
import { FormField, Input } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { BUSINESS_TYPES, CURRENCIES, ROLES } from "@/lib/constants";
import { cn } from "@/lib/utils";

type ActionResult = { ok: boolean; error?: string; message?: string; redirect?: string };

function useFormState(action: (_prev: ActionResult, formData: FormData) => Promise<ActionResult>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  return {
    pending,
    error,
    submit: async (formData: FormData) => {
      setPending(true);
      setError(undefined);
      const res = await action({ ok: false }, formData);
      setPending(false);
      if (res.ok) toast.success(res.message ?? "Saved");
      else setError(res.error ?? "Something went wrong");
    },
  };
}

export function OrganizationForm({ org }: { org: { name: string; businessType: string; currency: string; timezone: string; address: string | null; phone: string | null; email: string | null } }) {
  const { pending, error, submit } = useFormState(updateOrganization);
  return (
    <form action={submit} className="space-y-4">
      {error && <ErrorBox text={error} />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Business name" htmlFor="name">
          <Input id="name" name="name" defaultValue={org.name} required />
        </FormField>
        <FormField label="Business type">
          <SelectField name="businessType" defaultValue={org.businessType} options={BUSINESS_TYPES.map((b) => ({ value: b, label: b }))} />
        </FormField>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Currency">
          <SelectField name="currency" defaultValue={org.currency} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
        </FormField>
        <FormField label="Timezone" htmlFor="timezone">
          <Input id="timezone" name="timezone" defaultValue={org.timezone} placeholder="e.g. Asia/Karachi" />
        </FormField>
      </div>
      <FormField label="Address" htmlFor="address">
        <Input id="address" name="address" defaultValue={org.address ?? ""} />
      </FormField>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Phone" htmlFor="phone">
          <Input id="phone" name="phone" defaultValue={org.phone ?? ""} />
        </FormField>
        <FormField label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" defaultValue={org.email ?? ""} />
        </FormField>
      </div>
      <SubmitButton pending={pending}>Save organization</SubmitButton>
    </form>
  );
}

export function RentalRulesForm({ rules }: { rules: Record<string, unknown> }) {
  const { pending, error, submit } = useFormState(updateRentalRules);
  const bool = (v: unknown) => v === true;
  const num = (v: unknown) => (v ?? 0) as number;
  const hasCap = rules.lateFeeCap != null;

  return (
    <form action={submit} className="space-y-4">
      {error && <ErrorBox text={error} />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Billing rounding">
          <SelectField
            name="roundingRule"
            defaultValue={String(rules.roundingRule ?? "full_unit_per_period")}
            options={[
              { value: "full_unit_per_period", label: "Full unit per period (min 24h per day)" },
              { value: "calendar_unit", label: "Calendar unit (per calendar day)" },
            ]}
          />
        </FormField>
        <FormField label="Late fee unit">
          <SelectField
            name="lateFeeUnit"
            defaultValue={String(rules.lateFeeUnit ?? "hourly")}
            options={[
              { value: "hourly", label: "Per hour" },
              { value: "daily", label: "Per day" },
            ]}
          />
        </FormField>
      </div>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" name="lateFeeEnabled" defaultChecked={bool(rules.lateFeeEnabled)} className="h-4 w-4 rounded border-border" />
        Enable late fees
      </label>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Grace minutes" htmlFor="lateFeeGraceMinutes">
          <Input id="lateFeeGraceMinutes" name="lateFeeGraceMinutes" type="number" min={0} defaultValue={num(rules.lateFeeGraceMinutes)} />
        </FormField>
        <FormField label="Late fee rate" htmlFor="lateFeeRate">
          <Input id="lateFeeRate" name="lateFeeRate" type="number" min={0} step="0.01" defaultValue={num(rules.lateFeeRate)} />
        </FormField>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Late fee cap (optional)" htmlFor="lateFeeCap">
          <Input id="lateFeeCap" name="lateFeeCap" type="number" min={0} step="0.01" defaultValue={hasCap ? num(rules.lateFeeCap) : ""} placeholder="No cap" />
        </FormField>
        <FormField label="Deposit deduction auth threshold" htmlFor="depositDeductionAuthThreshold">
          <Input id="depositDeductionAuthThreshold" name="depositDeductionAuthThreshold" type="number" min={0} step="0.01" defaultValue={num(rules.depositDeductionAuthThreshold)} />
        </FormField>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label="Required fuel at return (%)" htmlFor="fuelRequiredReturnLevel">
          <Input id="fuelRequiredReturnLevel" name="fuelRequiredReturnLevel" type="number" min={0} max={100} defaultValue={num(rules.fuelRequiredReturnLevel)} />
        </FormField>
        <FormField label="Fuel price per percent" htmlFor="fuelPricePerPercent">
          <Input id="fuelPricePerPercent" name="fuelPricePerPercent" type="number" min={0} step="0.01" defaultValue={num(rules.fuelPricePerPercent)} />
        </FormField>
        <FormField label="Return reminder (hours before)" htmlFor="returnReminderHours">
          <Input id="returnReminderHours" name="returnReminderHours" type="number" min={0} defaultValue={num(rules.returnReminderHours)} />
        </FormField>
      </div>
      <SubmitButton pending={pending}>Save rental rules</SubmitButton>
    </form>
  );
}

export function InspectionSettingsForm({ settings }: { settings: { requireCustomerSignature: boolean; requiredPhotoCategories: string[] } }) {
  const { pending, error, submit } = useFormState(updateInspectionSettings);
  const [categories, setCategories] = useState<string[]>(settings.requiredPhotoCategories);
  const all = ["front", "rear", "left", "right", "roof", "interior", "dashboard", "engine", "tires", "damage", "other"];

  return (
    <form
      action={(fd) => {
        fd.set("requiredPhotoCategories", JSON.stringify(categories));
        return submit(fd);
      }}
      className="space-y-4"
    >
      {error && <ErrorBox text={error} />}
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" name="requireCustomerSignature" defaultChecked={settings.requireCustomerSignature} className="h-4 w-4 rounded border-border" />
        Require customer signature to complete handover
      </label>
      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Required photo categories</p>
        <div className="flex flex-wrap gap-2">
          {all.map((cat) => {
            const active = categories.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategories(active ? categories.filter((c) => c !== cat) : [...categories, cat])}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition",
                  active ? "border-brand bg-brand text-brand-foreground" : "border-border bg-card text-muted-foreground hover:border-border"
                )}
              >
                {active && <Check className="h-3.5 w-3.5" />}
                {cat}
              </button>
            );
          })}
        </div>
      </div>
      <SubmitButton pending={pending}>Save inspection settings</SubmitButton>
    </form>
  );
}

export function CurrencySettingsForm({ settings }: { settings: { displayCurrency: string | null; displayRate: number } }) {
  const { pending, error, submit } = useFormState(updateCurrencySettings);
  const [enabled, setEnabled] = useState(settings.displayCurrency != null);

  return (
    <form
      action={(fd) => {
        if (!enabled) fd.set("displayCurrency", "");
        return submit(fd);
      }}
      className="space-y-4"
    >
      {error && <ErrorBox text={error} />}
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        Show a secondary currency next to all prices
      </label>
      {enabled && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Display currency">
            <SelectField
              name="displayCurrency"
              defaultValue={settings.displayCurrency ?? "USD"}
              options={CURRENCIES.filter((c) => c !== "PKR").map((c) => ({ value: c, label: c }))}
            />
          </FormField>
          <FormField label="1 PKR =" htmlFor="displayRate">
            <Input
              id="displayRate"
              name="displayRate"
              type="number"
              min={0}
              step="0.000001"
              defaultValue={settings.displayRate || 0}
              placeholder="e.g. 0.0036"
              required={enabled}
            />
          </FormField>
        </div>
      )}
      {enabled && (
        <p className="text-xs text-muted-foreground">
          Enter how much 1 PKR is worth in the display currency. Base-priced assets are converted using this rate.
        </p>
      )}
      <SubmitButton pending={pending}>Save currency settings</SubmitButton>
    </form>
  );
}

export function TeamForm() {
  const { pending, error, submit } = useFormState(addTeamMember);
  return (
    <form action={submit} className="space-y-4">
      {error && <ErrorBox text={error} />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Name" htmlFor="memberName">
          <Input id="memberName" name="name" required />
        </FormField>
        <FormField label="Email" htmlFor="memberEmail">
          <Input id="memberEmail" name="email" type="email" required />
        </FormField>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Role">
          <SelectField name="role" defaultValue="Staff" options={ROLES.map((r) => ({ value: r, label: r }))} />
        </FormField>
        <FormField label="Temporary password" htmlFor="memberPassword">
          <Input id="memberPassword" name="password" type="password" required minLength={12} />
        </FormField>
      </div>
      <SubmitButton pending={pending}>Add team member</SubmitButton>
    </form>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive ring-1 ring-destructive/20">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      {text}
    </div>
  );
}
