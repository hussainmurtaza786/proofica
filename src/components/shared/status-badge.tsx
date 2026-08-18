"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "default" | "success" | "warning" | "danger" | "info" | "muted";

const TONES: Record<string, Tone> = {
  available: "success",
  completed: "success",
  active: "success",
  resolved: "success",
  returned: "success",
  held: "success",
  verified: "success",
  active_membership: "success",

  reserved: "info",
  awaiting_handover: "info",
  due_soon: "warning",
  scheduled: "info",
  pending: "warning",
  partially_returned: "warning",
  in_progress: "info",
  under_review: "warning",
  reported: "warning",
  customer_disputed: "warning",
  negotiation: "warning",
  returned_pending: "info",

  overdue: "danger",
  lost: "danger",
  critical: "danger",
  damaged: "danger",
  overdue_maint: "danger",

  maintenance: "muted",
  inspection: "muted",
  retired: "muted",
  archived: "muted",
  cancelled: "muted",
  draft: "muted",
  forfeited: "muted",
  rejected: "muted",
  completed_refund: "muted",

  rented: "default",
};

const STYLES: Record<Tone, string> = {
  default: "bg-muted text-muted-foreground border-border",
  success: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400",
  danger: "bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-400",
  info: "bg-brand/10 text-brand border-brand/20",
  muted: "bg-muted/50 text-muted-foreground border-border",
};

function labelFor(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = TONES[status] ?? "default";
  return (
    <Badge variant="outline" className={cn("border font-medium", STYLES[tone], className)}>
      {labelFor(status)}
    </Badge>
  );
}
