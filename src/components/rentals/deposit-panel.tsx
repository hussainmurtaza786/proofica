"use client";

import { useState } from "react";
import { AlertCircle, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { finalizeDepositReturn } from "@/server/actions/payments";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/shared/form-field";
import { StatusBadge } from "@/components/shared/status-badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { fmtDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Txn = { id: string; type: string; amount: unknown; reason: string | null; createdAt: Date };
type Deposit = { id: string; amount: unknown; status: string; heldAt: Date | null; returnedAt: Date | null };

export function DepositPanel({
  deposit,
  transactions,
  currency,
}: {
  deposit: Deposit;
  transactions: Txn[];
  currency: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<{ amount: string; reason: string }[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  const held = Number(deposit.amount) || 0;
  const totalDeduction = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const refund = Math.max(0, held - totalDeduction);

  const finalizable = ["pending", "held", "partially_returned"].includes(deposit.status);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(undefined);
    formData.set("depositId", deposit.id);
    formData.set("deductions", JSON.stringify(rows.filter((r) => Number(r.amount) > 0)));
    const result = await finalizeDepositReturn({ ok: false }, formData);
    setPending(false);
    if (result.ok) {
      toast.success(result.message ?? "Deposit finalized");
      setOpen(false);
      router.refresh();
    } else if (result.error) {
      setError(result.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Held amount</p>
          <p className="text-2xl font-semibold text-foreground">
            <Money value={deposit.amount} currency={currency} />
          </p>
        </div>
        <StatusBadge status={deposit.status} />
      </div>

      {deposit.returnedAt && <p className="text-xs text-muted-foreground">Finalized {fmtDateTime(deposit.returnedAt)}</p>}

      {transactions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transactions</p>
          {transactions.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="font-medium capitalize text-foreground">{t.type}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {t.reason ?? ""} · {fmtDateTime(t.createdAt)}
                </p>
              </div>
              <Money value={t.amount} currency={currency} negative={t.type === "deducted" || t.type === "forfeited"} />
            </div>
          ))}
        </div>
      )}

      {finalizable && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              Finalize deposit
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Finalize deposit</DialogTitle>
            </DialogHeader>
            <form action={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive ring-1 ring-destructive/20">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Held: <Money value={held} currency={currency} /> · Refund after deductions:{" "}
                <span className="font-semibold text-foreground">{formatMoney(refund, currency)}</span>
              </p>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Deductions</p>
                {rows.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="Amount"
                      className="w-32"
                      value={row.amount}
                      onChange={(e) => {
                        const next = [...rows];
                        next[i] = { ...next[i], amount: e.target.value };
                        setRows(next);
                      }}
                    />
                    <Input
                      placeholder="Reason (required)"
                      value={row.reason}
                      onChange={(e) => {
                        const next = [...rows];
                        next[i] = { ...next[i], reason: e.target.value };
                        setRows(next);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:text-red-500 dark:hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setRows([...rows, { amount: "", reason: "" }])}
                  className="flex items-center gap-1 text-sm font-medium text-brand hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" /> Add deduction
                </button>
              </div>

              <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm ring-1 ring-border">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total deductions</span>
                  <span className="font-medium text-foreground">{formatMoney(totalDeduction, currency)}</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-muted-foreground">Refund to customer</span>
                  <span className="font-semibold text-foreground">{formatMoney(refund, currency)}</span>
                </div>
              </div>

              <SubmitButton pending={pending} className="w-full">
                Finalize
              </SubmitButton>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function Money({ value, currency, negative = false }: { value: unknown; currency: string; negative?: boolean }) {
  return (
    <span className={cn("tabular-nums font-medium", negative && "text-red-600 dark:text-red-400")}>{formatMoney(value, currency)}</span>
  );
}
