"use client";

import { useState, useTransition } from "react";
import { pdf } from "@react-pdf/renderer";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InspectionReportDocument, type InspectionReportData } from "@/components/pdf/inspection-report-document";
import { RentalAgreementDocument, type RentalAgreementData } from "@/components/pdf/rental-agreement-document";

type Props =
  | { type: "inspection"; data: InspectionReportData; label?: string }
  | { type: "rental"; data: RentalAgreementData; label?: string };

export function PdfDownloadButton(props: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const label = props.label ?? (props.type === "inspection" ? "Download Inspection PDF" : "Download Agreement PDF");

  function handleDownload() {
    setError(null);
    startTransition(async () => {
      try {
        const doc = props.type === "inspection" ? (
          <InspectionReportDocument data={props.data} />
        ) : (
          <RentalAgreementDocument data={props.data} />
        );

        const blob = await pdf(doc).toBlob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = props.type === "inspection"
          ? `inspection-${props.data.rental.rentalNo}-${props.data.inspection.type}.pdf`
          : `rental-${props.data.rental.rentalNo}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate PDF");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleDownload} disabled={pending}>
        <Download className="mr-2 h-4 w-4" />
        {pending ? "Generating…" : label}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
