"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { signIn } from "@/auth/auth";
import type { ActionResult } from "@/lib/actions";

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Best-effort client IP. Behind a reverse proxy the left-most entry of
 * x-forwarded-for is the original client; without one, x-real-ip or a
 * fallback is used. Production note: replace the in-memory map with Redis
 * and configure trusted proxies so this header cannot be spoofed.
 */
function getClientIp(h: Headers): string {
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("x-real-ip") ?? "unknown";
}

export async function loginAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { ok: false, error: "Email and password are required." };
  }

  // Keyed per client IP + identity so one source cannot lock out other users.
  const ip = getClientIp(await headers());
  const key = `${ip}:${email.toLowerCase().trim()}`;
  const now = Date.now();
  const record = loginAttempts.get(key);

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
      const current = loginAttempts.get(key);
      if (!current || current.resetAt <= now) {
        loginAttempts.set(key, { count: 1, resetAt: now + LOCKOUT_MS });
      } else {
        loginAttempts.set(key, { count: current.count + 1, resetAt: current.resetAt });
      }
      return { ok: false, error: "Invalid email or password." };
    }
    throw error;
  }

  // Clear attempts on success.
  loginAttempts.delete(key);
  redirect("/dashboard");
}
