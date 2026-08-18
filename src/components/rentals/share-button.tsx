"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Check, Copy, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createShareLink } from "@/server/actions/share";
import { toast } from "sonner";

export function ShareButton({ rentalId }: { rentalId: string }) {
  const [state, action, pending] = useActionState(createShareLink, { ok: false });
  const [copied, setCopied] = useState(false);
  const url = state.redirect ?? "";

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Could not copy link");
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <form action={action}>
        <input type="hidden" name="rentalId" value={rentalId} />
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          <Link2 className="mr-2 h-4 w-4" /> Share report
        </Button>
      </form>
      {state.error && (
        <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="h-3.5 w-3.5" /> {state.error}
        </span>
      )}
      {url && (
        <div className="flex w-full items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
          <code className="min-w-0 flex-1 truncate text-xs text-foreground">{url}</code>
          <button type="button" onClick={copy} className="shrink-0 text-muted-foreground hover:text-brand">
            {copied ? <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      )}
    </div>
  );
}
