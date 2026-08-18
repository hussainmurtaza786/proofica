"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerAction } from "@/server/actions/auth";
import { SubmitButton } from "@/components/shared/submit-button";
import { FormField, Input } from "@/components/shared/form-field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { BUSINESS_TYPES, CURRENCIES } from "@/lib/constants";
import { SelectField } from "@/components/shared/select-field";

export default function RegisterPage() {
  const router = useRouter();
  const [state, action, pending] = useActionState(registerAction, { ok: false });

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl text-foreground">Create your workspace</CardTitle>
        <CardDescription>Set up your organization to start renting with proof.</CardDescription>
      </CardHeader>
      <CardContent>
        {state.error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive ring-1 ring-destructive/20">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {state.error}
          </div>
        )}
        <form action={action} className="space-y-4">
          <FormField label="Your name" htmlFor="name">
            <Input id="name" name="name" placeholder="Ahmed Khan" required />
          </FormField>
          <FormField label="Work email" htmlFor="email">
            <Input id="email" name="email" type="email" placeholder="you@company.com" required />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Password" htmlFor="password">
              <Input id="password" name="password" type="password" required minLength={8} />
            </FormField>
            <FormField label="Confirm password" htmlFor="confirmPassword">
              <Input id="confirmPassword" name="confirmPassword" type="password" required />
            </FormField>
          </div>

          <div className="border-t border-border pt-4">
            <p className="mb-3 text-sm font-medium text-foreground">Your business</p>
            <div className="space-y-4">
              <FormField label="Organization name" htmlFor="organizationName">
                <Input id="organizationName" name="organizationName" placeholder="ABC Car Rentals" required />
              </FormField>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Business type">
                  <SelectField
                    name="businessType"
                    defaultValue="Car Rental"
                    options={BUSINESS_TYPES.map((t) => ({ value: t, label: t }))}
                  />
                </FormField>
                <FormField label="Currency">
                  <SelectField
                    name="currency"
                    defaultValue="PKR"
                    options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                  />
                </FormField>
              </div>
            </div>
          </div>

          <SubmitButton pending={pending} className="w-full">
            Create workspace
          </SubmitButton>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
