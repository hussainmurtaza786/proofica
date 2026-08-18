import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Boxes, CheckCircle2, CircleDollarSign, Package, Wrench } from "lucide-react";

import { requireOrg } from "@/services/access";
import { prisma } from "@/lib/prisma";
import { getAllowedKinds } from "@/lib/constants";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { FilterBar } from "@/components/assets/filter-bar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata: Metadata = { title: "Assets" };

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireOrg();
  const params = await searchParams;
  const category = typeof params.category === "string" ? params.category : "";
  const status = typeof params.status === "string" ? params.status : "";

  const [allCategories, allAssets, org] = await Promise.all([
    prisma.assetCategory.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { name: "asc" },
    }),
    prisma.asset.findMany({
      where: { orgId: ctx.orgId },
      include: { category: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { businessType: true } }),
  ]);

  const allowedKinds = getAllowedKinds(org?.businessType ?? "Other");
  const allowedKindSet = new Set<string>(allowedKinds);
  const categories = allCategories.filter((c) => allowedKindSet.has(c.kind));
  const categoryIds = new Set(categories.map((c) => c.id));
  const assets = allAssets.filter((a) => categoryIds.has(a.categoryId));

  const filtered = assets.filter(
    (a) => (!category || a.categoryId === category) && (!status || a.status === status)
  );

  const stats = {
    available: assets.filter((a) => a.status === "available").length,
    rented: assets.filter((a) => a.status === "rented").length,
    maintenance: assets.filter((a) => ["maintenance", "inspection", "damaged"].includes(a.status)).length,
    total: assets.length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assets"
        description="Everything you rent out, and its condition."
        actions={
          <>
            <Link
              href="/assets/categories"
              className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Categories
            </Link>
            <Link
              href="/assets/new"
              className="inline-flex items-center justify-center rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-foreground hover:bg-brand-hover"
            >
              Add Asset
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Available" value={stats.available} icon={CheckCircle2} tone="success" />
        <StatCard label="Rented" value={stats.rented} icon={CircleDollarSign} />
        <StatCard label="Maintenance" value={stats.maintenance} icon={Wrench} tone="warning" />
        <StatCard label="Total" value={stats.total} icon={Boxes} />
      </div>

      <Suspense fallback={null}>
        <FilterBar
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          category={category}
          status={status}
        />
      </Suspense>

      <Card className="shadow-none border-border">
        <CardHeader>
          <CardTitle className="text-base text-foreground">All Assets</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <EmptyState
              icon={Package}
              title={assets.length === 0 ? "No assets yet" : "No assets match your filters"}
              description={
                assets.length === 0
                  ? "Add your first asset to start renting with proof."
                  : "Try adjusting or clearing the filters above."
              }
              actionLabel={assets.length === 0 ? "Add Asset" : undefined}
              href={assets.length === 0 ? "/assets/new" : undefined}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Meter</TableHead>
                  <TableHead className="text-right">View</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell>
                      <Link href={`/assets/${asset.id}`} className="block group">
                        <p className="font-medium text-foreground group-hover:text-brand">{asset.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {asset.assetNo}
                          {(asset.brand || asset.model) && ` · ${[asset.brand, asset.model].filter(Boolean).join(" ")}`}
                        </p>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-border bg-muted/50 font-medium text-foreground/80">
                        {asset.category.name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={asset.status} />
                    </TableCell>
                    <TableCell className="text-foreground/80">{asset.location || "—"}</TableCell>
                    <TableCell className="text-foreground/80">
                      {asset.mileage != null
                        ? `${asset.mileage.toLocaleString()} km`
                        : asset.engineHours != null
                          ? `${asset.engineHours} h`
                          : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/assets/${asset.id}`}
                        className="inline-flex items-center justify-center rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-brand-foreground hover:bg-brand-hover"
                      >
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
