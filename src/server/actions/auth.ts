"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validators";
import { signIn, signOut } from "@/auth/auth";
import type { ActionResult } from "@/lib/actions";
import { getAllowedKinds } from "@/lib/constants";

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}

export async function registerAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    organizationName: formData.get("organizationName"),
    businessType: formData.get("businessType"),
    currency: formData.get("currency"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const data = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
  if (existing) {
    return { ok: false, error: "An account with this email already exists." };
  }

  const passwordHash = await bcrypt.hash(data.password, 12);
  const slugBase = data.organizationName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const user = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        passwordHash,
        emailVerified: new Date(),
      },
    });

    let slug = slugBase || "org";
    let org = await tx.organization.findUnique({ where: { slug } });
    let counter = 1;
    while (org) {
      slug = `${slugBase}-${counter++}`;
      org = await tx.organization.findUnique({ where: { slug } });
    }

    const organization = await tx.organization.create({
      data: {
        name: data.organizationName,
        slug,
        businessType: data.businessType,
        currency: data.currency,
        members: {
          create: { userId: user.id, role: "Owner" },
        },
      },
    });

    // Default categories for the relevant asset kinds of this business type.
    const allowedKinds = getAllowedKinds(data.businessType);
    for (const kind of allowedKinds) {
      const label = kind.charAt(0).toUpperCase() + kind.slice(1) + "s";
      await tx.assetCategory.create({
        data: { orgId: organization.id, name: label, kind },
      });
    }

    return user;
  });

  await signIn("credentials", {
    email: data.email.toLowerCase(),
    password: data.password,
    redirect: false,
  });

  redirect("/dashboard");
}
