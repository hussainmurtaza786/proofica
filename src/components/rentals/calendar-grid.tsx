"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Wrench } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";

type Booking = {
  id: string;
  rentalNo: string;
  startAt: string;
  expectedReturnAt: string;
  status: string;
  assetName: string;
  customerName: string;
};

type Maint = { id: string; type: string; date: string; assetName: string };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarGrid({ rentals, maintenance }: { rentals: Booking[]; maintenance: Maint[] }) {
  const now = new Date();
  const [cursor, setCursor] = useState(new Date(now.getFullYear(), now.getMonth(), 1));

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const days = useMemo(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const leading = first.getDay();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < leading; i++) cells.push(null);
    for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d));
    return cells;
  }, [year, month]);

  const byDay = useMemo(() => {
    const map = new Map<string, { rentals: Booking[]; maintenance: Maint[] }>();
    for (const r of rentals) {
      const key = r.startAt.slice(0, 10);
      const entry = map.get(key) ?? { rentals: [], maintenance: [] };
      entry.rentals.push(r);
      map.set(key, entry);
    }
    for (const m of maintenance) {
      const key = m.date.slice(0, 10);
      const entry = map.get(key) ?? { rentals: [], maintenance: [] };
      entry.maintenance.push(m);
      map.set(key, entry);
    }
    return map;
  }, [rentals, maintenance]);

  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{monthLabel}</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date(year, month - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date(now.getFullYear(), now.getMonth(), 1))} disabled={isCurrentMonth}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date(year, month + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((d) => (
          <div key={d} className="pb-1 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {d}
          </div>
        ))}
        {days.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} className="h-24 rounded-lg border border-dashed border-border" />;
          const key = day.toISOString().slice(0, 10);
          const entry = byDay.get(key);
          const isToday = day.toDateString() === now.toDateString();
          return (
            <div
              key={key}
              className={`min-h-24 rounded-lg border p-1.5 ${
                isToday ? "border-brand/60 bg-brand/10" : "border-border bg-card"
              }`}
            >
              <p className={`mb-1 text-xs font-semibold ${isToday ? "text-brand" : "text-muted-foreground"}`}>{day.getDate()}</p>
              <div className="space-y-1">
                {entry?.rentals.slice(0, 2).map((r) => (
                  <Link
                    key={r.id}
                    href={`/rentals/${r.id}`}
                    className="block truncate rounded px-1.5 py-0.5 text-[11px] font-medium text-brand ring-1 ring-brand/30 hover:bg-brand/10"
                    title={`${r.rentalNo} · ${r.assetName} · ${r.customerName}`}
                  >
                    {r.rentalNo}
                  </Link>
                ))}
                {entry?.maintenance.slice(0, 1).map((m) => (
                  <span
                    key={m.id}
                    className="flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-500/30 dark:text-amber-400"
                    title={`${m.type} · ${m.assetName}`}
                  >
                    <Wrench className="h-2.5 w-2.5 shrink-0" />
                    {m.type}
                  </span>
                ))}
                {entry && entry.rentals.length + entry.maintenance.length > 3 && (
                  <p className="text-[10px] text-muted-foreground">
                    +{entry.rentals.length + entry.maintenance.length - 3} more
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Upcoming bookings</h3>
        <div className="space-y-2">
          {rentals
            .filter((r) => r.startAt.slice(0, 10) >= now.toISOString().slice(0, 10))
            .sort((a, b) => a.startAt.localeCompare(b.startAt))
            .slice(0, 12)
            .map((r) => (
              <Link key={r.id} href={`/rentals/${r.id}`} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 transition hover:border-brand/40 hover:bg-brand/10">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {r.assetName} <span className="text-muted-foreground">·</span> {r.customerName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.rentalNo} · {new Date(r.startAt).toLocaleString()} → {new Date(r.expectedReturnAt).toLocaleString()}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </Link>
            ))}
          {rentals.filter((r) => r.startAt.slice(0, 10) >= now.toISOString().slice(0, 10)).length === 0 && (
            <p className="text-sm text-muted-foreground">No upcoming bookings.</p>
          )}
        </div>
      </div>
    </div>
  );
}
