"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginAction } from "@/server/actions/login";
import { SubmitButton } from "@/components/shared/submit-button";
import { FormField, Input } from "@/components/shared/form-field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [state, action, pending] = useActionState(loginAction, { ok: false });

  useEffect(() => {
    if (state.ok && state.message) {
      toast.success(state.message);
    }
    if (state.ok) {
      router.push("/dashboard");
    }
  }, [state, router]);

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl text-foreground">Welcome back</CardTitle>
        <CardDescription>Sign in to your Proofica workspace</CardDescription>
      </CardHeader>
      <CardContent>
        {state.error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive ring-1 ring-destructive/20">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {state.error}
          </div>
        )}
        <form action={action} className="space-y-4">
          <FormField label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" placeholder="you@company.com" autoComplete="email" required />
          </FormField>
          <FormField label="Password" htmlFor="password">
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </FormField>
          <SubmitButton pending={pending} className="w-full">
            Sign in
          </SubmitButton>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          New to Proofica?{" "}
          <Link href="/register" className="font-medium text-brand hover:underline">
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
