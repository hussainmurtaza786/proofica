"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { recordPayment } from "@/server/actions/payments";
import { SubmitButton } from "@/components/shared/submit-button";
import { FormField, Input } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { PAYMENT_METHODS, PAYMENT_TYPES } from "@/lib/constants";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function PaymentForm({ rentalId }: { rentalId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(undefined);
    formData.set("rentalId", rentalId);
    const result = await recordPayment({ ok: false }, formData);
    setPending(false);
    if (result.ok) {
      toast.success(result.message ?? "Payment recorded");
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
          <Plus className="mr-2 h-4 w-4" /> Record payment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700 ring-1 ring-red-100">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Amount" htmlFor="amount">
              <Input id="amount" name="amount" type="number" min={0} step="0.01" required />
            </FormField>
            <FormField label="Type">
              <SelectField name="type" defaultValue="rental" options={PAYMENT_TYPES.map((t) => ({ value: t, label: t }))} />
            </FormField>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Method">
              <SelectField name="method" defaultValue="cash" options={PAYMENT_METHODS.map((m) => ({ value: m, label: m.replaceAll("_", " ") }))} />
            </FormField>
            <FormField label="Reference" htmlFor="reference">
              <Input id="reference" name="reference" placeholder="e.g. TRX-1234" />
            </FormField>
          </div>
          <FormField label="Notes" htmlFor="notes">
            <Input id="notes" name="notes" />
          </FormField>
          <SubmitButton pending={pending} className="w-full">
            Record
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
