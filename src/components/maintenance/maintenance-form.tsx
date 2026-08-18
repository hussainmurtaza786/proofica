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
import { Textarea } from "@/components/ui/textarea";
import { createMaintenance } from "@/server/actions/expenses";
import { MAINTENANCE_TYPES, MAINTENANCE_TYPE_LABELS } from "@/lib/constants";

export function MaintenanceForm({ assets }: { assets: { value: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(undefined);
    const result = await createMaintenance({ ok: false }, formData);
    setPending(false);
    if (result.ok) {
      toast.success(result.message ?? "Maintenance saved");
      setOpen(false);
    } else if (result.error) {
      setError(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> Schedule
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule Maintenance</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Asset">
              <SelectField name="assetId" placeholder="Select asset" options={assets} />
            </FormField>
            <FormField label="Type">
              <SelectField
                name="type"
                defaultValue="general"
                options={MAINTENANCE_TYPES.map((t) => ({
                  value: t,
                  label: MAINTENANCE_TYPE_LABELS[t],
                }))}
              />
            </FormField>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField label="Date" htmlFor="date">
              <Input id="date" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
            </FormField>
            <FormField label="Cost" htmlFor="cost">
              <Input id="cost" name="cost" type="number" step="0.01" min="0" defaultValue="0" />
            </FormField>
            <FormField label="Status">
              <SelectField
                name="status"
                defaultValue="scheduled"
                options={[
                  { value: "scheduled", label: "Scheduled" },
                  { value: "in_progress", label: "In progress" },
                  { value: "completed", label: "Completed" },
                  { value: "overdue", label: "Overdue" },
                ]}
              />
            </FormField>
          </div>
          <FormField label="Vendor" htmlFor="vendor">
            <Input id="vendor" name="vendor" placeholder="Workshop or provider" />
          </FormField>
          <FormField label="Description" htmlFor="description">
            <Textarea id="description" name="description" placeholder="What needs to be done?" />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Mileage" htmlFor="mileage">
              <Input id="mileage" name="mileage" type="number" min="0" placeholder="Odometer reading" />
            </FormField>
            <FormField label="Engine hours" htmlFor="engineHours">
              <Input id="engineHours" name="engineHours" type="number" min="0" placeholder="Meter hours" />
            </FormField>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Next due date" htmlFor="nextDate">
              <Input id="nextDate" name="nextDate" type="date" />
            </FormField>
            <FormField label="Next due mileage" htmlFor="nextMileage">
              <Input id="nextMileage" name="nextMileage" type="number" min="0" placeholder="Mileage at next service" />
            </FormField>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <SubmitButton pending={pending} className="w-full">
            Save maintenance
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
