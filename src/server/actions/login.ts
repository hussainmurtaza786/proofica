"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth/auth";
import type { ActionResult } from "@/lib/actions";

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function getClientIp(): string {
  // In production, use x-forwarded-for header. For now, use a default.
  return "global";
}

export async function loginAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { ok: false, error: "Email and password are required." };
  }

  const ip = getClientIp();
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (record && record.resetAt > now && record.count >= MAX_ATTEMPTS) {
    const remaining = Math.ceil((record.resetAt - now) / 60000);
    return { ok: false, error: `Too many login attempts. Try again in ${remaining} minute${remaining > 1 ? "s" : ""}.` };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // Track failed attempt.
      const current = loginAttempts.get(ip);
      if (!current || current.resetAt <= now) {
        loginAttempts.set(ip, { count: 1, resetAt: now + LOCKOUT_MS });
      } else {
        loginAttempts.set(ip, { count: current.count + 1, resetAt: current.resetAt });
      }
      return { ok: false, error: "Invalid email or password." };
    }
    throw error;
  }

  // Clear attempts on success.
  loginAttempts.delete(ip);
  redirect("/dashboard");
}
