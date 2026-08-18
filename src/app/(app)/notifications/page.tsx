import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";

import { requireOrg } from "@/services/access";
import { prisma } from "@/lib/prisma";
import { markNotificationRead } from "@/server/actions/settings";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { fmtRelative } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

async function markRead(formData: FormData) {
  "use server";
  await markNotificationRead({ ok: false }, formData);
}

export default async function NotificationsPage() {
  const ctx = await requireOrg();
  const notifications = await prisma.notification.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Alerts about rentals, payments, maintenance and more."
      />

      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications yet" />
      ) : (
        <Card className="shadow-none border-border">
          <CardContent className="space-y-3">
            {notifications.map((n) => {
              const unread = !n.readAt;
              const item = (
                <div
                  className={cn(
                    "rounded-lg border px-4 py-3",
                    unread ? "border-brand/20 bg-brand/5 ring-1 ring-brand/20" : "border-border bg-card"
                  )}
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p
                      className={cn(
                        "text-sm font-semibold",
                        unread ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {n.title}
                    </p>
                    <StatusBadge status={n.type} />
                    <div className="ml-auto flex shrink-0 items-center gap-3">
                      <span className="text-xs text-muted-foreground">{fmtRelative(n.createdAt)}</span>
                      {unread && (
                        <form action={markRead}>
                          <input type="hidden" name="id" value={n.id} />
                          <button type="submit" className="text-xs font-medium text-brand hover:underline">
                            Mark read
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                  {n.body && <p className="mt-1 text-sm text-foreground/80">{n.body}</p>}
                </div>
              );
              return n.link ? (
                <Link key={n.id} href={n.link} className="block">
                  {item}
                </Link>
              ) : (
                <div key={n.id}>{item}</div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
