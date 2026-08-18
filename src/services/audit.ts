import "server-only";

import { prisma } from "@/lib/prisma";

export type AuditEntry = {
  orgId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  description?: string;
  changes?: unknown;
};

/**
 * Records an immutable audit event. Never edit audit rows.
 */
export async function audit(entry: AuditEntry) {
  await prisma.auditLog.create({
    data: {
      orgId: entry.orgId,
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      description: entry.description,
      changes: entry.changes ? JSON.stringify(entry.changes) : undefined,
    },
  });
}
