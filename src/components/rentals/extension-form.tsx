"use client";

import { useState } from "react";
import { AlertCircle, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { extendRental } from "@/server/actions/rentals";
import { SubmitButton } from "@/components/shared/submit-button";
import { FormField, Input } from "@/components/shared/form-field";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function ExtensionForm({
  rentalId,
  currentReturnAt,
  minAt,
}: {
  rentalId: string;
  currentReturnAt: string;
  minAt: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(undefined);
    formData.set("rentalId", rentalId);
    const result = await extendRental({ ok: false }, formData);
    setPending(false);
    if (result.ok) {
      toast.success(result.message ?? "Rental extended");
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
          <Plus className="mr-2 h-4 w-4" /> Extend rental
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Extend rental</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive ring-1 ring-destructive/20">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Current return: {new Date(currentReturnAt).toLocaleString()}. New return must be after this.
          </p>
          <FormField label="New return date & time" htmlFor="toAt">
            <Input id="toAt" name="toAt" type="datetime-local" min={minAt} required />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Additional cost" htmlFor="additionalCost" hint="Leave 0 to auto-compute">
              <Input id="additionalCost" name="additionalCost" type="number" min={0} step="0.01" defaultValue={0} />
            </FormField>
            <FormField label="Additional deposit" htmlFor="additionalDeposit">
              <Input id="additionalDeposit" name="additionalDeposit" type="number" min={0} step="0.01" defaultValue={0} />
            </FormField>
          </div>
          <SubmitButton pending={pending} className="w-full">
            Extend
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
