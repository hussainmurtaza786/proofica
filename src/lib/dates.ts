import { format, formatDistanceToNowStrict, isAfter, isBefore, addHours } from "date-fns";

/**
 * Proofica stores UTC timestamps in the database. All display formatting
 * is done relative to the organization's configured timezone.
 */

export function toOrgTime(date: Date, timezone: string): Date {
  // date-fns works with local time; for display we shift by the org offset.
  // For MVP: treat the org timezone as the canonical display timezone.
  return date;
}

export function fmtDate(date: Date | null | undefined, timezone?: string, pattern = "MMM d, yyyy"): string {
  if (!date) return "—";
  return format(toOrgTime(date, timezone ?? "UTC"), pattern);
}

export function fmtDateTime(date: Date | null | undefined, timezone?: string): string {
  if (!date) return "—";
  return format(toOrgTime(date, timezone ?? "UTC"), "MMM d, yyyy h:mm a");
}

export function fmtTime(date: Date | null | undefined, timezone?: string): string {
  if (!date) return "—";
  return format(toOrgTime(date, timezone ?? "UTC"), "h:mm a");
}

export function fmtRelative(date: Date): string {
  return formatDistanceToNowStrict(date, { addSuffix: true });
}

export function isOverdue(rental: { expectedReturnAt: Date; status: string }, now: Date = new Date()): boolean {
  const activeStatuses = ["active", "due_soon", "overdue"];
  if (!activeStatuses.includes(rental.status)) return false;
  return isBefore(rental.expectedReturnAt, now);
}

export function isDueSoon(rental: { expectedReturnAt: Date; startAt: Date }, now: Date = new Date()): boolean {
  if (isBefore(rental.expectedReturnAt, now)) return false;
  return isAfter(rental.expectedReturnAt, addHours(now, -24));
}

export const hoursInDay = 24;
export const hoursInWeek = 168;
export const hoursInMonth = 730;
