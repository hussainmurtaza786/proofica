"use client";

import { useState } from "react";
import { AlertCircle, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addRentalCharge } from "@/server/actions/rentals";
import { SubmitButton } from "@/components/shared/submit-button";
import { FormField, Input } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { CHARGE_TYPES } from "@/lib/constants";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function ChargeForm({ rentalId }: { rentalId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(undefined);
    formData.set("rentalId", rentalId);
    const result = await addRentalCharge({ ok: false }, formData);
    setPending(false);
    if (result.ok) {
      toast.success(result.message ?? "Charge added");
      setOpen(false);
      router.refresh();
    } else if (result.error) {
      setError(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="mr-2 h-4 w-4" /> Add charge
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add charge</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700 ring-1 ring-red-100">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Type">
              <SelectField name="type" defaultValue="custom" options={CHARGE_TYPES.map((t) => ({ value: t, label: t }))} />
            </FormField>
            <FormField label="Amount" htmlFor="amount">
              <Input id="amount" name="amount" type="number" min={0} step="0.01" required />
            </FormField>
          </div>
          <FormField label="Description" htmlFor="description">
            <Input id="description" name="description" placeholder="e.g. Cleaning fee" required />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Quantity" htmlFor="qty" hint="Defaults to 1">
              <Input id="qty" name="qty" type="number" min={1} step="1" defaultValue={1} />
            </FormField>
            <FormField label="Reason" htmlFor="reason">
              <Input id="reason" name="reason" />
            </FormField>
          </div>
          <SubmitButton pending={pending} className="w-full">
            Add charge
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
