import type { Metadata } from "next";
import { CalendarRange } from "lucide-react";

import { requireOrg } from "@/services/access";
import { prisma } from "@/lib/prisma";
import { getAssetBookings } from "@/services/availability";
import { PageHeader } from "@/components/shared/page-header";
import { CalendarGrid } from "@/components/rentals/calendar-grid";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage() {
  const ctx = await requireOrg();
  const [{ rentals, maintenance }, assets] = await Promise.all([
    getAssetBookings(ctx.orgId),
    prisma.asset.findMany({
      where: { orgId: ctx.orgId, status: { not: "retired" } },
      select: { id: true, name: true, assetNo: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="Bookings across your fleet for the current month."
        actions={
          <span className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
            <CalendarRange className="h-4 w-4 text-brand" />
            {assets.length} assets
          </span>
        }
      />

      <CalendarGrid
        rentals={rentals.map((r) => ({
          id: r.id,
          rentalNo: r.rentalNo,
          startAt: r.startAt.toISOString(),
          expectedReturnAt: r.expectedReturnAt.toISOString(),
          status: r.status,
          assetName: r.asset.name,
          customerName: r.customer.name,
        }))}
        maintenance={maintenance.map((m) => ({
          id: m.id,
          type: m.type,
          date: m.date.toISOString(),
          assetName: m.asset.name,
        }))}
      />
    </div>
  );
}
