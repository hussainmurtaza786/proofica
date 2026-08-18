import type { Metadata } from "next";

import { requireOrg } from "@/services/access";
import { getRentalReportData } from "@/services/rental-report";
import { getOrgSettings } from "@/services/settings";
import { RentalReport } from "@/components/rentals/rental-report";
import { PrintButton } from "@/components/rentals/print-button";

export const metadata: Metadata = { title: "Rental report" };

export default async function RentalReportPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrg();
  const { id } = await params;
  const [data, settings] = await Promise.all([getRentalReportData(ctx.orgId, id), getOrgSettings(ctx.orgId)]);
  if (!data) return <p className="py-16 text-center text-sm text-muted-foreground">Rental not found.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Rental report</h1>
        <PrintButton />
      </div>
      <RentalReport data={data} currencySettings={settings.currencySettings} />
    </div>
  );
}
