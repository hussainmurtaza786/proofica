import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { getRentalReportData } from "@/services/rental-report";
import { RentalReport } from "@/components/rentals/rental-report";
import { PrintButton } from "@/components/rentals/print-button";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export const metadata: Metadata = {
  title: "Shared rental report",
  robots: { index: false, follow: false },
};

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const link = await prisma.shareLink.findUnique({ where: { token } });
  if (!link || link.revokedAt || (link.expiresAt && link.expiresAt < new Date())) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-xl font-semibold text-foreground">Link unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This shared link has expired or been revoked. Contact the rental provider for a fresh link.
        </p>
      </div>
    );
  }

  const data = await getRentalReportData(link.orgId, link.rentalId);
  if (!data) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-xl font-semibold text-foreground">Report not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">The rental associated with this link no longer exists.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted py-8 print:bg-white print:py-0">
      <div className="mx-auto max-w-3xl space-y-6 px-4">
        <div className="flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Shared rental report</h1>
            <ThemeToggle />
          </div>
          <PrintButton />
        </div>
        <div className="rounded-2xl bg-card p-6 shadow-sm print:rounded-none print:p-0 print:shadow-none">
          <RentalReport data={data} />
        </div>
      </div>
    </div>
  );
}
