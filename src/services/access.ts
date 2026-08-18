import "server-only";

import { redirect } from "next/navigation";
import { auth } from "@/auth/auth";
import { prisma } from "@/lib/prisma";
import { Permission, roleHasPermission } from "@/lib/constants";
import type { Role } from "@/lib/constants";

export type SessionContext = {
  userId: string;
  orgId: string;
  role: Role;
  orgName: string;
  userEmail: string;
};

/**
 * Requires an authenticated session. Redirects to login otherwise.
 */
export async function requireSession(): Promise<{ userId: string; email: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return { userId: session.user.id, email: session.user.email ?? "" };
}

/**
 * Requires an authenticated session that belongs to an active organization
 * membership. Returns the org-scoped context.
 */
export async function requireOrg(): Promise<SessionContext> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId: session.user.id,
      status: "active",
      org: { id: session.user.orgId ?? "" },
    },
    include: { org: true },
  });

  if (!membership) {
    redirect("/login");
  }

  return {
    userId: session.user.id,
    orgId: membership.orgId,
    role: membership.role as Role,
    orgName: membership.org.name,
    userEmail: session.user.email ?? "",
  };
}

/**
 * Requires a permission. Redirects to dashboard when missing.
 */
export async function requirePermission(permission: Permission): Promise<SessionContext> {
  const ctx = await requireOrg();
  if (!roleHasPermission(ctx.role, permission)) {
    redirect("/dashboard");
  }
  return ctx;
}

export function can(ctx: SessionContext, permission: Permission): boolean {
  return roleHasPermission(ctx.role, permission);
}

/**
 * Resolves the latest org/role from the database for a user, used after
 * sign-in / org switching. Returns null when no active membership exists.
 */
export async function resolveActiveOrg(userId: string, preferredOrgId?: string | null) {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId, status: "active" },
    include: { org: true },
    orderBy: { createdAt: "asc" },
  });
  if (memberships.length === 0) return null;

  const preferred = preferredOrgId
    ? memberships.find((m) => m.orgId === preferredOrgId)
    : undefined;
  return (preferred ?? memberships[0]);
}
