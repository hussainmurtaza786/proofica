"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";

import { updateCustomer } from "@/server/actions/customers";
import { SubmitButton } from "@/components/shared/submit-button";
import { FormField, Input } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ID_TYPES = ["CNIC", "Passport", "Driving License", "NICOP", "Other"];

function toDateInput(value: Date | null | undefined): string | undefined {
  if (!value) return undefined;
  return new Date(value).toISOString().slice(0, 10);
}

export function CustomerEditForm({
  customer,
}: {
  customer: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    address: string | null;
    city: string | null;
    country: string | null;
    idType: string | null;
    idNumber: string | null;
    idExpiry: Date | null;
    licenseNumber: string | null;
    licenseExpiry: Date | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    notes: string | null;
  };
  timezone: string;
  currency: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateCustomer, { ok: false });

  useEffect(() => {
    if (state.redirect) router.push(state.redirect);
    else if (state.ok) router.push(`/customers/${customer.id}`);
  }, [state, router, customer.id]);

  return (
    <Card className="shadow-none border-border">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl text-foreground">Edit Customer</CardTitle>
        <CardDescription>Update the details for {customer.name}.</CardDescription>
      </CardHeader>
      <CardContent>
        {state.error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive ring-1 ring-destructive/20">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {state.error}
          </div>
        )}
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={customer.id} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Full name" htmlFor="name">
              <Input id="name" name="name" defaultValue={customer.name} required />
            </FormField>
            <FormField label="Phone" htmlFor="phone">
              <Input id="phone" name="phone" defaultValue={customer.phone} required />
            </FormField>
            <FormField label="Email" htmlFor="email">
              <Input id="email" name="email" type="email" defaultValue={customer.email ?? ""} />
            </FormField>
            <FormField label="Address" htmlFor="address">
              <Input id="address" name="address" defaultValue={customer.address ?? ""} />
            </FormField>
            <FormField label="City" htmlFor="city">
              <Input id="city" name="city" defaultValue={customer.city ?? ""} />
            </FormField>
            <FormField label="Country" htmlFor="country">
              <Input id="country" name="country" defaultValue={customer.country ?? ""} />
            </FormField>
            <FormField label="ID type" htmlFor="idType">
              <SelectField
                name="idType"
                defaultValue={customer.idType ?? ""}
                placeholder="Select ID type"
                options={ID_TYPES.map((t) => ({ value: t, label: t }))}
              />
            </FormField>
            <FormField label="ID number" htmlFor="idNumber">
              <Input id="idNumber" name="idNumber" defaultValue={customer.idNumber ?? ""} />
            </FormField>
            <FormField label="ID expiry" htmlFor="idExpiry">
              <Input id="idExpiry" name="idExpiry" type="date" defaultValue={toDateInput(customer.idExpiry)} />
            </FormField>
            <FormField label="License number" htmlFor="licenseNumber">
              <Input id="licenseNumber" name="licenseNumber" defaultValue={customer.licenseNumber ?? ""} />
            </FormField>
            <FormField label="License expiry" htmlFor="licenseExpiry">
              <Input
                id="licenseExpiry"
                name="licenseExpiry"
                type="date"
                defaultValue={toDateInput(customer.licenseExpiry)}
              />
            </FormField>
            <FormField label="Emergency contact name" htmlFor="emergencyContactName">
              <Input
                id="emergencyContactName"
                name="emergencyContactName"
                defaultValue={customer.emergencyContactName ?? ""}
              />
            </FormField>
            <FormField label="Emergency contact phone" htmlFor="emergencyContactPhone">
              <Input
                id="emergencyContactPhone"
                name="emergencyContactPhone"
                defaultValue={customer.emergencyContactPhone ?? ""}
              />
            </FormField>
          </div>
          <FormField label="Notes" htmlFor="notes">
            <Textarea id="notes" name="notes" defaultValue={customer.notes ?? ""} />
          </FormField>
          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
            <Link href={`/customers/${customer.id}`} className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Cancel
            </Link>
            <SubmitButton pending={pending}>Save Changes</SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
