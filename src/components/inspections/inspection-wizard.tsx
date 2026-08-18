"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Gauge,
  Loader2,
  PenLine,
  Save,
  ShieldCheck,
  Trash2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import {
  saveMeterReadings,
  saveInspectionItems,
  saveDamages,
  saveInspectionPhoto,
  saveSignature,
  completeInspection,
} from "@/server/actions/inspections";
import { FileUploader } from "@/components/shared/file-uploader";
import { SignaturePad } from "@/components/shared/signature-pad";
import { FormField, Input } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PHOTO_CATEGORIES = ["front", "rear", "left", "right", "interior", "dashboard", "engine", "tires", "damage", "other"];

const STATUS_OPTIONS = [
  { value: "ok", label: "OK" },
  { value: "issue", label: "Issue" },
  { value: "missing", label: "Missing" },
  { value: "na", label: "N/A" },
] as const;

type ItemState = {
  id?: string;
  label: string;
  section: string;
  category?: string;
  beforeValue?: string;
  afterValue?: string;
  status: string;
  notes?: string;
  sortOrder: number;
};

type DamageState = {
  id?: string;
  category: string;
  location: string;
  description: string;
  severity: string;
  estimatedRepairCost: number;
  isPreExisting: boolean;
};

type PhotoState = { url: string; category: string };

type SigState = { name: string; dataUrl: string };

export function InspectionWizard({
  inspectionId,
  rentalId,
  type,
  asset,
  items,
  damages,
  photos,
  signatures,
  settings,
}: {
  inspectionId: string;
  rentalId: string;
  type: "handover" | "return";
  asset: { mileage: number | null; engineHours: number | null; fuelLevel: number | null };
  items: ItemState[];
  damages: DamageState[];
  photos: PhotoState[];
  signatures: { role: "customer" | "staff"; name: string; dataUrl: string }[];
  settings: { requiredPhotoCategories: string[]; requireCustomerSignature: boolean };
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);

  const meterItem = (label: string) => items.find((i) => i.section === "meter" && i.label === label);

  const [meters, setMeters] = useState({
    mileage: asset.mileage ?? undefined,
    engineHours: asset.engineHours ?? undefined,
    fuelLevel: asset.fuelLevel ?? undefined,
    oilLevel: "",
    notes: "",
  });
  const [checklist, setChecklist] = useState<ItemState[]>(items.filter((i) => i.section !== "meter"));
  const [damageList, setDamageList] = useState<DamageState[]>(damages);
  const [photoList, setPhotoList] = useState<PhotoState[]>(photos);
  const [sigCustomer, setSigCustomer] = useState<SigState>(
    signatures.find((s) => s.role === "customer") ?? { name: "", dataUrl: "" }
  );
  const [sigStaff, setSigStaff] = useState<SigState>(signatures.find((s) => s.role === "staff") ?? { name: "", dataUrl: "" });

  const steps = [
    { id: "meters", label: "Meters", icon: Gauge },
    { id: "checklist", label: "Checklist", icon: ClipboardList },
    { id: "damages", label: "Damages", icon: Wrench },
    { id: "photos", label: "Photos", icon: Camera },
    { id: "signatures", label: "Signatures", icon: PenLine },
    { id: "review", label: "Review", icon: ShieldCheck },
  ];

  function itemValue(item: ItemState): string {
    if (item.status === "na") return "N/A";
    if (item.section === "functional") return item.status === "ok" ? "Working" : "Not working";
    if (item.section === "accessory") return item.status === "ok" ? "Present" : "Missing";
    return item.notes || item.status;
  }

  async function saveStep() {
    setSaving(true);
    setError(undefined);
    try {
      if (step === 0) {
        const fd = new FormData();
        fd.set("inspectionId", inspectionId);
        if (meters.mileage != null) fd.set("mileage", String(meters.mileage));
        if (meters.engineHours != null) fd.set("engineHours", String(meters.engineHours));
        if (meters.fuelLevel != null) fd.set("fuelLevel", String(meters.fuelLevel));
        fd.set("oilLevel", meters.oilLevel);
        fd.set("notes", meters.notes);
        const res = await saveMeterReadings({ ok: false }, fd);
        if (!res.ok) throw new Error(res.error ?? "Could not save meters");
      } else if (step === 1) {
        const payload = checklist.map((item) => ({
          id: item.id,
          label: item.label,
          section: item.section,
          category: item.category,
          status: item.status,
          notes: item.notes ?? "",
          sortOrder: item.sortOrder,
          ...(type === "handover"
            ? { beforeValue: itemValue(item), afterValue: "" }
            : { afterValue: itemValue(item), beforeValue: "" }),
        }));
        const fd = new FormData();
        fd.set("inspectionId", inspectionId);
        fd.set("items", JSON.stringify(payload));
        const res = await saveInspectionItems({ ok: false }, fd);
        if (!res.ok) throw new Error(res.error ?? "Could not save checklist");
      } else if (step === 2) {
        const fd = new FormData();
        fd.set("inspectionId", inspectionId);
        fd.set(
          "damages",
          JSON.stringify(
            damageList.map((d) => ({ ...d, estimatedRepairCost: Number(d.estimatedRepairCost) || 0 }))
          )
        );
        const res = await saveDamages({ ok: false }, fd);
        if (!res.ok) throw new Error(res.error ?? "Could not save damages");
      } else if (step === 3) {
        // Photos are saved as they upload.
      } else if (step === 4) {
        if (sigCustomer.dataUrl) {
          const fd = new FormData();
          fd.set("inspectionId", inspectionId);
          fd.set("role", "customer");
          fd.set("name", sigCustomer.name || "Customer");
          fd.set("dataUrl", sigCustomer.dataUrl);
          const res = await saveSignature({ ok: false }, fd);
          if (!res.ok) throw new Error(res.error ?? "Could not save customer signature");
        }
        if (sigStaff.dataUrl) {
          const fd = new FormData();
          fd.set("inspectionId", inspectionId);
          fd.set("role", "staff");
          fd.set("name", sigStaff.name || "Staff");
          fd.set("dataUrl", sigStaff.dataUrl);
          const res = await saveSignature({ ok: false }, fd);
          if (!res.ok) throw new Error(res.error ?? "Could not save staff signature");
        }
      }
      setStep((s) => Math.min(s + 1, steps.length - 1));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function complete() {
    setSaving(true);
    setError(undefined);
    try {
      const fd = new FormData();
      fd.set("inspectionId", inspectionId);
      const res = await completeInspection({ ok: false }, fd);
      if (!res.ok) throw new Error(res.error ?? "Could not complete inspection");
      setDone(true);
      toast.success(res.message ?? "Inspection completed");
      router.push(`/rentals/${rentalId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not complete inspection");
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-20 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400">
          <Check className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-foreground">Inspection completed</h3>
        <p className="mt-1 text-sm text-muted-foreground">Redirecting to the rental…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1.5">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => i < step && setStep(i)}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition",
                i === step ? "bg-brand text-brand-foreground" : i < step ? "text-brand hover:bg-brand/10" : "text-muted-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {s.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive ring-1 ring-destructive/20">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {step === 0 && (
        <div className="grid grid-cols-1 gap-6 rounded-xl border border-border bg-card p-6 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Mileage (km)" htmlFor="mileage" hint={meterItem("Mileage")?.beforeValue ?? undefined}>
            <Input
              id="mileage"
              type="number"
              min={0}
              placeholder="e.g. 42000"
              value={meters.mileage ?? ""}
              onChange={(e) => setMeters({ ...meters, mileage: e.target.value ? Number(e.target.value) : undefined })}
            />
          </FormField>
          <FormField label="Engine hours" htmlFor="engineHours">
            <Input
              id="engineHours"
              type="number"
              min={0}
              placeholder="e.g. 120"
              value={meters.engineHours ?? ""}
              onChange={(e) => setMeters({ ...meters, engineHours: e.target.value ? Number(e.target.value) : undefined })}
            />
          </FormField>
          <FormField label="Fuel level (%)" htmlFor="fuelLevel">
            <Input
              id="fuelLevel"
              type="number"
              min={0}
              max={100}
              placeholder="e.g. 80"
              value={meters.fuelLevel ?? ""}
              onChange={(e) => setMeters({ ...meters, fuelLevel: e.target.value ? Number(e.target.value) : undefined })}
            />
          </FormField>
          <FormField label="Oil level" htmlFor="oilLevel">
            <Input
              id="oilLevel"
              placeholder="Full / half / low"
              value={meters.oilLevel}
              onChange={(e) => setMeters({ ...meters, oilLevel: e.target.value })}
            />
          </FormField>
          <FormField label="Notes" htmlFor="notes" className="sm:col-span-2 lg:col-span-4">
            <Input
              id="notes"
              placeholder="Any observations…"
              value={meters.notes}
              onChange={(e) => setMeters({ ...meters, notes: e.target.value })}
            />
          </FormField>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-6 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Functional tests
            </div>
            {checklist
              .filter((i) => i.section === "functional")
              .map((item) => (
                <ChecklistRow key={item.id ?? item.label} item={item} onChange={(next) => updateItem(item, next)} />
              ))}
          </div>
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-6 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Accessories & equipment
            </div>
            {checklist
              .filter((i) => i.section === "accessory")
              .map((item) => (
                <ChecklistRow key={item.id ?? item.label} item={item} onChange={(next) => updateItem(item, next)} />
              ))}
          </div>
          {checklist.filter((i) => i.section === "meter").length > 0 && (
            <div className="rounded-xl border border-border bg-card px-6 py-4 text-sm text-muted-foreground">
              Meter readings are captured in the <span className="font-medium">Meters</span> step.
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          {damageList.map((d, idx) => (
            <div key={d.id ?? idx} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <FormField label="Category">
                      <select
                        value={d.category}
                        onChange={(e) => updateDamage(idx, { category: e.target.value })}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/30"
                      >
                        {PHOTO_CATEGORIES_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Severity">
                      <select
                        value={d.severity}
                        onChange={(e) => updateDamage(idx, { severity: e.target.value })}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/30"
                      >
                        {DAMAGE_SEVERITIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Est. repair cost">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={d.estimatedRepairCost || ""}
                        onChange={(e) => updateDamage(idx, { estimatedRepairCost: Number(e.target.value) || 0 })}
                      />
                    </FormField>
                  </div>
                  <FormField label="Location" htmlFor={`loc-${idx}`}>
                    <Input
                      id={`loc-${idx}`}
                      placeholder="e.g. Right rear door"
                      value={d.location}
                      onChange={(e) => updateDamage(idx, { location: e.target.value })}
                    />
                  </FormField>
                  <FormField label="Description" htmlFor={`desc-${idx}`}>
                    <Input
                      id={`desc-${idx}`}
                      placeholder="Describe the damage…"
                      value={d.description}
                      onChange={(e) => updateDamage(idx, { description: e.target.value })}
                    />
                  </FormField>
                  {type === "return" && (
                    <label className="flex items-center gap-2 text-sm text-foreground/80">
                      <input
                        type="checkbox"
                        checked={d.isPreExisting}
                        onChange={(e) => updateDamage(idx, { isPreExisting: e.target.checked })}
                        className="h-4 w-4 rounded border-border"
                      />
                      Pre-existing (noted at handover)
                    </label>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setDamageList(damageList.filter((_, i) => i !== idx))}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:text-red-500 dark:hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setDamageList([...damageList, { category: "other", location: "", description: "", severity: "minor", estimatedRepairCost: 0, isPreExisting: false }])
            }
          >
            <Wrench className="mr-2 h-4 w-4" /> Add damage
          </Button>
        </div>
      )}

      {step === 3 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PHOTO_CATEGORIES.map((cat) => {
            const existing = photoList.filter((p) => p.category === cat);
            const required = settings.requiredPhotoCategories.includes(cat);
            return (
              <div key={cat} className="rounded-xl border border-border bg-card p-4">
                <p className="mb-2 text-sm font-semibold capitalize text-foreground">
                  {cat}
                  {required && <span className="ml-2 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-400">required</span>}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {existing.map((p, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={p.url} alt={p.category} className="h-16 w-full rounded-md object-cover ring-1 ring-border" />
                  ))}
                </div>
                <FileUploader
                  compact
                  folder="inspections"
                  category={cat}
                  onUploaded={async (file, category) => {
                    const res = await saveInspectionPhoto(inspectionId, file.url, file.key, category ?? "other");
                    if (!res.ok) {
                      toast.error(res.error ?? "Could not save photo");
                      return;
                    }
                    setPhotoList((prev) => [...prev, { url: file.url, category: category ?? "other" }]);
                    toast.success("Photo saved");
                  }}
                />
              </div>
            );
          })}
        </div>
      )}

      {step === 4 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="text-sm font-semibold text-foreground">Customer signature</h3>
            <p className="mb-4 mt-1 text-xs text-muted-foreground">
              {type === "handover" ? "Customer confirms handover condition." : "Customer acknowledges return condition."}
            </p>
            <FormField label="Name" htmlFor="custName">
              <Input
                id="custName"
                value={sigCustomer.name}
                onChange={(e) => setSigCustomer({ ...sigCustomer, name: e.target.value })}
                placeholder="Customer name"
              />
            </FormField>
            <SignaturePad onSigned={(dataUrl) => setSigCustomer({ ...sigCustomer, dataUrl })} />
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="text-sm font-semibold text-foreground">Staff signature</h3>
            <p className="mb-4 mt-1 text-xs text-muted-foreground">Inspector / staff member performing this inspection.</p>
            <FormField label="Name" htmlFor="staffName">
              <Input
                id="staffName"
                value={sigStaff.name}
                onChange={(e) => setSigStaff({ ...sigStaff, name: e.target.value })}
                placeholder="Staff name"
              />
            </FormField>
            <SignaturePad onSigned={(dataUrl) => setSigStaff({ ...sigStaff, dataUrl })} />
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <SummaryCard title="Meters">
            <p className="text-sm text-foreground/80">Mileage: <b>{meters.mileage ?? "—"}</b></p>
            <p className="text-sm text-foreground/80">Engine hours: <b>{meters.engineHours ?? "—"}</b></p>
            <p className="text-sm text-foreground/80">Fuel: <b>{meters.fuelLevel != null ? `${meters.fuelLevel}%` : "—"}</b></p>
            <p className="text-sm text-foreground/80">Oil: <b>{meters.oilLevel || "—"}</b></p>
          </SummaryCard>
          <SummaryCard title="Checklist">
            <p className="text-sm text-foreground/80">
              {checklist.length} items ·{" "}
              {checklist.filter((i) => i.status === "issue" || i.status === "missing").length} issue(s)
            </p>
            <p className="text-sm text-foreground/80">Damages recorded: <b>{damageList.length}</b></p>
          </SummaryCard>
          <SummaryCard title="Photos & signatures">
            <p className="text-sm text-foreground/80">Photos: <b>{photoList.length}</b></p>
            <p className="text-sm text-foreground/80">Customer signed: <b>{sigCustomer.dataUrl ? "Yes" : "No"}</b></p>
            <p className="text-sm text-foreground/80">Staff signed: <b>{sigStaff.dataUrl ? "Yes" : "No"}</b></p>
          </SummaryCard>
          <div className="lg:col-span-3">
            {settings.requireCustomerSignature && type === "handover" && !sigCustomer.dataUrl && (
              <p className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-400">
                The customer signature is required before this handover can be completed.
              </p>
            )}
            {settings.requiredPhotoCategories.filter((c) => !photoList.some((p) => p.category === c)).length > 0 && (
              <p className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-400">
                Missing required photos:{" "}
                {settings.requiredPhotoCategories.filter((c) => !photoList.some((p) => p.category === c)).join(", ")}.
              </p>
            )}
            <Button onClick={complete} disabled={saving} className="w-full sm:w-auto">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Complete {type} inspection
            </Button>
          </div>
        </div>
      )}

      {step < 5 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || saving}>
            <ChevronLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <Button onClick={saveStep} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save & continue
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      {step === 5 && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => setStep(4)} disabled={saving}>
            <ChevronLeft className="mr-2 h-4 w-4" /> Back
          </Button>
        </div>
      )}
    </div>
  );

  function updateItem(target: ItemState, next: Partial<ItemState>) {
    setChecklist((prev) => prev.map((i) => (i === target ? { ...i, ...next } : i)));
  }

  function updateDamage(idx: number, next: Partial<DamageState>) {
    setDamageList((prev) => prev.map((d, i) => (i === idx ? { ...d, ...next } : d)));
  }
}

const PHOTO_CATEGORIES_CATEGORIES = ["scratch", "dent", "crack", "broken", "missing", "fuel", "other"];
const DAMAGE_SEVERITIES = ["cosmetic", "minor", "moderate", "major", "critical"];

function ChecklistRow({ item, onChange }: { item: ItemState; onChange: (next: ItemState) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-3 last:border-0">
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{item.label}</p>
        {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange({ ...item, status: opt.value })}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition",
              item.status === opt.value
                ? opt.value === "ok"
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : opt.value === "issue"
                    ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    : opt.value === "missing"
                      ? "border-red-500 bg-destructive/10 text-destructive"
                      : "border-border bg-muted text-muted-foreground"
                : "border-border text-muted-foreground hover:border-border hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
