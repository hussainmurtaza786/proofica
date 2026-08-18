"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormField, Input } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { createExpense } from "@/server/actions/expenses";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from "@/lib/constants";

function AssetSelect({ options }: { options: { value: string; label: string }[] }) {
  const [value, setValue] = useState("none");
  return (
    <div>
      <input type="hidden" name="assetId" value={value === "none" ? "" : value} />
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">— None —</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ExpenseForm({ assets }: { assets: { value: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(undefined);
    const result = await createExpense({ ok: false }, formData);
    setPending(false);
    if (result.ok) {
      toast.success(result.message ?? "Expense recorded");
      setOpen(false);
    } else if (result.error) {
      setError(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> Record Expense
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Expense</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Category">
              <SelectField
                name="category"
                defaultValue="other"
                options={EXPENSE_CATEGORIES.map((c) => ({
                  value: c,
                  label: EXPENSE_CATEGORY_LABELS[c],
                }))}
              />
            </FormField>
            <FormField label="Asset">
              <AssetSelect options={assets} />
            </FormField>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Amount" htmlFor="amount">
              <Input id="amount" name="amount" type="number" step="0.01" min="0" placeholder="0.00" required />
            </FormField>
            <FormField label="Date" htmlFor="date">
              <Input id="date" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
            </FormField>
          </div>
          <FormField label="Vendor" htmlFor="vendor">
            <Input id="vendor" name="vendor" placeholder="Supplier or service provider" />
          </FormField>
          <FormField label="Description" htmlFor="description">
            <Textarea id="description" name="description" placeholder="What was this for?" />
          </FormField>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <SubmitButton pending={pending} className="w-full">
            Save expense
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
