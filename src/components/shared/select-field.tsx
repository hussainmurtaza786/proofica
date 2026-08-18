"use client";

import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function SelectField({
  name,
  options,
  defaultValue,
  value,
  placeholder,
  className,
  triggerClassName,
  onValueChange,
}: {
  name?: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  value?: string;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  onValueChange?: (value: string) => void;
}) {
  const [internal, setInternal] = useState(defaultValue ?? "");
  const current = value !== undefined ? value : internal;

  return (
    <div className={className}>
      {name && <input type="hidden" name={name} value={current} />}
      <Select
        value={current || undefined}
        onValueChange={(v) => {
          if (value === undefined) setInternal(v);
          onValueChange?.(v);
        }}
      >
        <SelectTrigger className={triggerClassName}>
          <SelectValue placeholder={placeholder ?? "Select…"} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
