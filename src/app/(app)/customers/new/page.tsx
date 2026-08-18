"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";

import { createCustomer } from "@/server/actions/customers";
import { SubmitButton } from "@/components/shared/submit-button";
import { FormField, Input } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ID_TYPES = ["CNIC", "Passport", "Driving License", "NICOP", "Other"];

export default function NewCustomerPage() {
  const router = useRouter();
  const [state, action, pending] = useActionState(createCustomer, { ok: false });

  useEffect(() => {
    if (state.redirect) router.push(state.redirect);
    else if (state.ok) router.push("/customers");
  }, [state, router]);

  return (
    <Card className="shadow-none border-border">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl text-foreground">New Customer</CardTitle>
        <CardDescription>Add a customer to start renting to them with proof.</CardDescription>
      </CardHeader>
      <CardContent>
        {state.error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive ring-1 ring-destructive/20">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {state.error}
          </div>
        )}
        <form action={action} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Full name" htmlFor="name">
              <Input id="name" name="name" placeholder="Ahmed Khan" required />
            </FormField>
            <FormField label="Phone" htmlFor="phone">
              <Input id="phone" name="phone" placeholder="+92 300 1234567" required />
            </FormField>
            <FormField label="Email" htmlFor="email">
              <Input id="email" name="email" type="email" placeholder="ahmed@example.com" />
            </FormField>
            <FormField label="Address" htmlFor="address">
              <Input id="address" name="address" placeholder="House 12, Street 5" />
            </FormField>
            <FormField label="City" htmlFor="city">
              <Input id="city" name="city" placeholder="Lahore" />
            </FormField>
            <FormField label="Country" htmlFor="country">
              <Input id="country" name="country" placeholder="Pakistan" />
            </FormField>
            <FormField label="ID type" htmlFor="idType">
              <SelectField
                name="idType"
                placeholder="Select ID type"
                options={ID_TYPES.map((t) => ({ value: t, label: t }))}
              />
            </FormField>
            <FormField label="ID number" htmlFor="idNumber">
              <Input id="idNumber" name="idNumber" placeholder="42201-1234567-8" />
            </FormField>
            <FormField label="ID expiry" htmlFor="idExpiry">
              <Input id="idExpiry" name="idExpiry" type="date" />
            </FormField>
            <FormField label="License number" htmlFor="licenseNumber">
              <Input id="licenseNumber" name="licenseNumber" placeholder="LHR-123456" />
            </FormField>
            <FormField label="License expiry" htmlFor="licenseExpiry">
              <Input id="licenseExpiry" name="licenseExpiry" type="date" />
            </FormField>
            <FormField label="Emergency contact name" htmlFor="emergencyContactName">
              <Input id="emergencyContactName" name="emergencyContactName" placeholder="Fatima Khan" />
            </FormField>
            <FormField label="Emergency contact phone" htmlFor="emergencyContactPhone">
              <Input id="emergencyContactPhone" name="emergencyContactPhone" placeholder="+92 301 1234567" />
            </FormField>
          </div>
          <FormField label="Notes" htmlFor="notes">
            <Textarea id="notes" name="notes" placeholder="Anything worth remembering about this customer…" />
          </FormField>
          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
            <Link href="/customers" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Cancel
            </Link>
            <SubmitButton pending={pending}>Create Customer</SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
