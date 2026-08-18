"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { updateAssetStatus } from "@/server/actions/assets";
import { ASSET_STATUSES, ASSET_STATUS_LABELS } from "@/lib/constants";
import { SelectField } from "@/components/shared/select-field";
import { SubmitButton } from "@/components/shared/submit-button";

export function StatusChange({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateAssetStatus, { ok: false });

  useEffect(() => {
    if (state.redirect) router.push(state.redirect);
    else if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={id} />
        <SelectField
          name="status"
          defaultValue={status}
          options={ASSET_STATUSES.map((s) => ({ value: s, label: ASSET_STATUS_LABELS[s] ?? s }))}
        />
        <SubmitButton pending={pending} variant="outline" size="sm">
          Update
        </SubmitButton>
      </form>
      {state.error && (
        <span className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="h-3 w-3" />
          {state.error}
        </span>
      )}
    </div>
  );
}
