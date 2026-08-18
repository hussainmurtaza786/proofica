"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startInspection } from "@/server/actions/inspections";

export function StartInspectionButton({
  rentalId,
  type,
  label,
  variant = "default",
}: {
  rentalId: string;
  type: "handover" | "return";
  label: string;
  variant?: "default" | "outline";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setError(null);
    try {
      const res = await startInspection(rentalId, type);
      if (res.ok && res.id) {
        router.push(`/rentals/${rentalId}/inspections/${type}?inspectionId=${res.id}`);
      } else {
        setError(res.error ?? "Could not start inspection");
        setBusy(false);
      }
    } catch {
      setError("Could not start inspection");
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <Button variant={variant} size="sm" onClick={onClick} disabled={busy}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardCheck className="mr-2 h-4 w-4" />}
        {label}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
