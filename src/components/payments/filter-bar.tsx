"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAYMENT_METHODS, PAYMENT_TYPES } from "@/lib/constants";

function cap(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function PaymentFilterBar({ type, method }: { type?: string; method?: string }) {
  const router = useRouter();
  const pathname = usePathname();

  function apply(nextType: string, nextMethod: string) {
    const params = new URLSearchParams();
    if (nextType && nextType !== "all") params.set("type", nextType);
    if (nextMethod && nextMethod !== "all") params.set("method", nextMethod);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={type ?? "all"} onValueChange={(v) => apply(v, method ?? "all")}>
        <SelectTrigger size="sm" className="w-40">
          <SelectValue placeholder="All types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          {PAYMENT_TYPES.map((t) => (
            <SelectItem key={t} value={t}>
              {cap(t)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={method ?? "all"} onValueChange={(v) => apply(type ?? "all", v)}>
        <SelectTrigger size="sm" className="w-40">
          <SelectValue placeholder="All methods" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All methods</SelectItem>
          {PAYMENT_METHODS.map((m) => (
            <SelectItem key={m} value={m}>
              {cap(m)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
