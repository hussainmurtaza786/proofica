import "server-only";

import { prisma } from "@/lib/prisma";

type NotifyInput = {
  orgId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  userId?: string; // null => org-wide
};

/**
 * Notification service abstraction. Currently persists in-app notifications.
 * Email / SMS / WhatsApp providers can be added here later without changing
 * call sites — keep provider integration out of the callers.
 */
export async function notify(input: NotifyInput) {
  await prisma.notification.create({
    data: {
      orgId: input.orgId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
    },
  });
}
