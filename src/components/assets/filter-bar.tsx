"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ASSET_STATUSES, ASSET_STATUS_LABELS } from "@/lib/constants";

export function FilterBar({
  categories,
  category,
  status,
}: {
  categories: { id: string; name: string }[];
  category: string;
  status: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function apply(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "all") params.delete(key);
    else params.set(key, value);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const hasFilter = Boolean(category || status);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={category || "all"} onValueChange={(value) => apply("category", value)}>
        <SelectTrigger size="sm" className="min-w-44">
          <SelectValue placeholder="All Categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={status || "all"} onValueChange={(value) => apply("status", value)}>
        <SelectTrigger size="sm" className="min-w-44">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {ASSET_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {ASSET_STATUS_LABELS[s] ?? s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilter && (
        <Link href="/assets" className="text-sm font-medium text-brand hover:underline">
          Clear
        </Link>
      )}
    </div>
  );
}
