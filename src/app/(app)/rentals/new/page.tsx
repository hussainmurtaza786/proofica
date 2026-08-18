import type { Metadata } from "next";
import Link from "next/link";

import { requireOrg } from "@/services/access";
import { prisma } from "@/lib/prisma";
import { getAllowedKinds } from "@/lib/constants";
import { RentalForm } from "@/components/rentals/rental-form";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "New Rental" };

export default async function NewRentalPage() {
  const ctx = await requireOrg();
  const [customers, allAssets, org] = await Promise.all([
    prisma.customer.findMany({
      where: { orgId: ctx.orgId, status: { not: "archived" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, customerNo: true },
    }),
    prisma.asset.findMany({
      where: { orgId: ctx.orgId, status: { in: ["available", "reserved"] } },
      include: { category: true },
      orderBy: { name: "asc" },
    }),
    prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { currency: true, businessType: true } }),
  ]);

  const allowedKinds = getAllowedKinds(org?.businessType ?? "Other");
  const allowedKindSet = new Set<string>(allowedKinds);
  const assets = allAssets.filter((a) => allowedKindSet.has(a.category.kind));

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Rental"
        description="Reserve an asset for a customer. Handover activates it."
        actions={
          <Link href="/rentals" className="text-sm font-medium text-brand hover:underline">
            Back to rentals
          </Link>
        }
      />
      <Card className="mx-auto max-w-3xl shadow-none border-border">
        <CardHeader>
          <CardTitle className="text-base text-foreground">Rental details</CardTitle>
        </CardHeader>
        <CardContent>
          <RentalForm
            customers={customers}
            assets={assets.map((a) => ({ id: a.id, name: `${a.name} (${a.assetNo})`, kind: a.category.kind, status: a.status }))}
            currency={org?.currency ?? "PKR"}
          />
        </CardContent>
      </Card>
    </div>
  );
}
