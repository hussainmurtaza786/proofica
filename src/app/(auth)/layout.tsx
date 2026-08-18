import { ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/40 lg:grid lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-brand p-10 text-brand-foreground lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-foreground/15">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-lg font-semibold">Proofica</p>
            <p className="text-xs text-brand-foreground/70">Protect every rental with proof.</p>
          </div>
        </div>
        <div className="max-w-md space-y-6">
          <h2 className="text-3xl font-semibold leading-tight">
            Know exactly what condition your asset left in — and what came back.
          </h2>
          <ul className="space-y-3 text-sm text-brand-foreground/80">
            <li>• Handover & return inspections with photo evidence</li>
            <li>• Mileage, hours, fuel and functional test comparisons</li>
            <li>• Deposits, deductions and auditable payment records</li>
            <li>• Damage disputes resolved with timestamped proof</li>
          </ul>
        </div>
        <p className="text-xs text-brand-foreground/60">
          The customer says the damage was already there? You&apos;ll have the proof.
        </p>
      </div>
      <div className="relative flex flex-1 items-center justify-center p-6">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
