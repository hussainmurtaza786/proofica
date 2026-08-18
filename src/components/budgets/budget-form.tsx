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
import { FormField, Input } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { createBudget } from "@/server/actions/expenses";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from "@/lib/constants";

export function BudgetForm() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(undefined);
    const result = await createBudget({ ok: false }, formData);
    setPending(false);
    if (result.ok) {
      toast.success(result.message ?? "Budget saved");
      setOpen(false);
    } else if (result.error) {
      setError(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> New Budget
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Budget</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Category">
              <SelectField
                name="category"
                options={EXPENSE_CATEGORIES.map((c) => ({
                  value: c,
                  label: EXPENSE_CATEGORY_LABELS[c],
                }))}
              />
            </FormField>
            <FormField label="Period">
              <SelectField
                name="period"
                defaultValue="monthly"
                options={[
                  { value: "monthly", label: "Monthly" },
                  { value: "yearly", label: "Yearly" },
                ]}
              />
            </FormField>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Amount" htmlFor="amount">
              <Input id="amount" name="amount" type="number" step="0.01" min="0" placeholder="0.00" required />
            </FormField>
            <FormField label="Month" htmlFor="month">
              <Input id="month" name="month" type="number" min="1" max="12" defaultValue={new Date().getMonth() + 1} />
            </FormField>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Year" htmlFor="year">
              <Input id="year" name="year" type="number" min="2000" max="2100" defaultValue={new Date().getFullYear()} required />
            </FormField>
            <FormField label="Threshold (%)" htmlFor="threshold">
              <Input id="threshold" name="threshold" type="number" min="1" max="100" defaultValue="85" />
            </FormField>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <SubmitButton pending={pending} className="w-full">
            Save budget
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
