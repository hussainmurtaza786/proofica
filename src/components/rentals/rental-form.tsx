"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";

import { createRental } from "@/server/actions/rentals";
import { SubmitButton } from "@/components/shared/submit-button";
import { FormField, Input } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { PRICING_MODELS } from "@/lib/constants";
import { previewDurationHours, previewRentalTotals } from "@/lib/pricing-preview";
import { formatMoney } from "@/lib/money";

const PRICING_LABELS: Record<string, string> = {
  hourly: "Hourly",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  custom: "Custom",
};

export function RentalForm({
  customers,
  assets,
  currency,
}: {
  customers: { id: string; name: string; customerNo: string }[];
  assets: { id: string; name: string; kind: string; status: string }[];
  currency: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createRental, { ok: false });

  const [startAt, setStartAt] = useState("");
  const [returnAt, setReturnAt] = useState("");
  const [pricingModel, setPricingModel] = useState("daily");
  const [rate, setRate] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [discount, setDiscount] = useState("");
  const [taxPercent, setTaxPercent] = useState("");

  const hours = previewDurationHours(startAt || null, returnAt || null);
  const calendarDays = Math.ceil(hours / 24);
  const preview = previewRentalTotals({
    pricingModel,
    rate: Number(rate) || 0,
    quantity: Number(quantity) || 1,
    hours,
    calendarDays,
    discount: Number(discount) || 0,
    taxPercent: Number(taxPercent) || 0,
  });

  return (
    <form action={action} className="space-y-5">
      {state.error && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive ring-1 ring-destructive/20">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Customer" htmlFor="customerId">
          <SelectField
            name="customerId"
            placeholder="Select customer…"
            options={customers.map((c) => ({ value: c.id, label: `${c.name} (${c.customerNo})` }))}
          />
        </FormField>
        <FormField label="Asset" htmlFor="assetId">
          <SelectField name="assetId" placeholder="Select asset…" options={assets.map((a) => ({ value: a.id, label: a.name }))} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Start date & time" htmlFor="startAt">
          <Input
            id="startAt"
            name="startAt"
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            required
          />
        </FormField>
        <FormField label="Expected return" htmlFor="expectedReturnAt">
          <Input
            id="expectedReturnAt"
            name="expectedReturnAt"
            type="datetime-local"
            value={returnAt}
            onChange={(e) => setReturnAt(e.target.value)}
            required
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Pricing model">
          <SelectField
            name="pricingModel"
            defaultValue="daily"
            onValueChange={setPricingModel}
            options={PRICING_MODELS.map((m) => ({ value: m, label: PRICING_LABELS[m] ?? m }))}
            className="[&>button]:w-full"
          />
        </FormField>
        <FormField label="Rate" htmlFor="rate" hint="Per unit of the pricing model">
          <Input
            id="rate"
            name="rate"
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        </FormField>
        <FormField label="Quantity" htmlFor="quantity" hint="Number of units (e.g. 5 chairs)">
          <Input
            id="quantity"
            name="quantity"
            type="number"
            min={1}
            step={1}
            placeholder="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Deposit required" htmlFor="depositRequired" hint="Held until return, refundable minus deductions">
          <Input id="depositRequired" name="depositRequired" type="number" min={0} step="0.01" placeholder="0.00" />
        </FormField>
        <FormField label="Discount" htmlFor="discount">
          <Input id="discount" name="discount" type="number" min={0} step="0.01" placeholder="0.00" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </FormField>
      </div>

      <FormField label="Tax %" htmlFor="taxPercent" hint="Leave at 0 if tax is included in your rates">
        <Input id="taxPercent" name="taxPercent" type="number" min={0} max={100} step="0.01" placeholder="0" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} />
      </FormField>

      <FormField label="Notes" htmlFor="notes">
        <textarea
          id="notes"
          name="notes"
          rows={3}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-brand/50"
          placeholder="Pickup instructions, delivery address, special requests…"
        />
      </FormField>

      {hours > 0 && (
        <div className="rounded-lg bg-muted/50 p-4 ring-1 ring-border">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Price preview</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Duration</dt>
              <dd className="font-medium text-foreground">
                {preview.quantity} × {preview.units} unit(s)
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Gross</dt>
              <dd className="font-medium text-foreground">{formatMoney(preview.gross, currency)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Discount</dt>
              <dd className="font-medium text-foreground">− {formatMoney(preview.discount, currency)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Tax</dt>
              <dd className="font-medium text-foreground">{formatMoney(preview.tax, currency)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Total due</dt>
              <dd className="text-base font-semibold text-foreground">{formatMoney(preview.total, currency)}</dd>
            </div>
          </dl>
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <SubmitButton pending={pending}>Create rental</SubmitButton>
        <button type="button" onClick={() => router.back()} className="text-sm text-muted-foreground hover:text-foreground">
          Cancel
        </button>
      </div>
    </form>
  );
}
