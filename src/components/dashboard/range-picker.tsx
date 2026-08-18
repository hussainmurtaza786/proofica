"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

const RANGES: { value: string; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "lastMonth", label: "Last Month" },
  { value: "year", label: "This Year" },
];

export function RangePicker({ active }: { active: string }) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
      {RANGES.map((r) => (
        <Link
          key={r.value}
          href={`/dashboard?range=${r.value}`}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition",
            active === r.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {r.label}
        </Link>
      ))}
    </div>
  );
}
