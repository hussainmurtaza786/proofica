import type { Metadata } from "next";
import Link from "next/link";

import { requireOrg } from "@/services/access";
import { prisma } from "@/lib/prisma";
import { getAllowedKinds } from "@/lib/constants";
import { PageHeader } from "@/components/shared/page-header";
import { AssetForm } from "@/components/assets/asset-form";

export const metadata: Metadata = { title: "New Asset" };

export default async function NewAssetPage() {
  const ctx = await requireOrg();

  const [allCategories, org] = await Promise.all([
    prisma.assetCategory.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { name: "asc" },
    }),
    prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { businessType: true } }),
  ]);

  const allowedKinds = getAllowedKinds(org?.businessType ?? "Other");
  const categories = allCategories.filter((c) => (allowedKinds as readonly string[]).includes(c.kind));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Asset"
        description="Register a new asset to your fleet."
        actions={
          <Link
            href="/assets"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Back to Assets
          </Link>
        }
      />

      <AssetForm categories={categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind, customFieldsJson: c.customFieldsJson }))} />
    </div>
  );
}
