import type { Metadata } from "next";
import Link from "next/link";
import { Layers } from "lucide-react";

import { requireOrg } from "@/services/access";
import { prisma } from "@/lib/prisma";
import { KIND_LABELS, getAllowedKinds } from "@/lib/constants";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { CategoryForm } from "@/components/assets/category-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parseCustomFields } from "@/lib/custom-fields";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const ctx = await requireOrg();

  const [categories, org] = await Promise.all([
    prisma.assetCategory.findMany({
      where: { orgId: ctx.orgId },
      include: { _count: { select: { assets: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { businessType: true } }),
  ]);

  const allowedKinds = getAllowedKinds(org?.businessType ?? "Other");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description="Group your assets so they are easy to find and report on."
        actions={
          <Link
            href="/assets"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Back to Assets
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="h-fit shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">New Category</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryForm allowedKinds={allowedKinds} />
          </CardContent>
        </Card>

        <Card className="shadow-none border-border lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base text-foreground">All Categories</CardTitle>
          </CardHeader>
          <CardContent>
            {categories.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="No categories yet"
                description="Create your first category to organize the fleet."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Custom fields</TableHead>
                    <TableHead>Assets</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((c) => {
                    const customFieldCount = parseCustomFields(c.customFieldsJson).length;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium text-foreground">{c.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-border bg-muted/50 font-medium text-foreground/80">
                            {KIND_LABELS[c.kind] ?? c.kind}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-foreground/80">{customFieldCount > 0 ? `${customFieldCount} field(s)` : "—"}</TableCell>
                        <TableCell className="text-foreground/80">{c._count.assets}</TableCell>
                        <TableCell className="text-foreground/80">{c.description || "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
