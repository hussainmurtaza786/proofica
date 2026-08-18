import Link from "next/link";
import { TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/shared/page-header";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { MoneyDisplay } from "@/components/shared/money-display";
import { StatCard } from "@/components/shared/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtDate } from "@/lib/dates";
import { toDecimal } from "@/lib/decimal";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/services/access";
import type { Prisma } from "@prisma/client";

export const metadata = { title: "Expenses" };

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireOrg();
  const params = await searchParams;
  const categoryParam = typeof params.category === "string" ? params.category : undefined;
  const category =
    categoryParam && (EXPENSE_CATEGORIES as readonly string[]).includes(categoryParam)
      ? categoryParam
      : undefined;

  const year = new Date().getFullYear();
  const where: Prisma.ExpenseWhereInput = { orgId: ctx.orgId };
  if (category) where.category = category;

  const [expenses, totalAgg, org, assets] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: { asset: true },
      orderBy: { date: "desc" },
      take: 200,
    }),
    prisma.expense.aggregate({
      where: { ...where, date: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
      _sum: { amount: true },
    }),
    prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { currency: true } }),
    prisma.asset.findMany({
      where: { orgId: ctx.orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const currency = org?.currency ?? "PKR";
  const total = totalAgg._sum.amount ?? toDecimal(0);
  const assetOptions = assets.map((a) => ({ value: a.id, label: a.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description="Track every cost across your operation."
        actions={<ExpenseForm assets={assetOptions} />}
      />

      <StatCard
        label={`Total ${year}`}
        value={<MoneyDisplay value={total} currency={currency} />}
        icon={TrendingDown}
        hint={category ? `${EXPENSE_CATEGORY_LABELS[category]} this year` : "All categories this year"}
      />

      <Card className="shadow-none border-border">
        <CardContent className="p-0">
          {expenses.length === 0 ? (
            <EmptyState
              title="No expenses recorded"
              description="Record your first expense to see it here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Asset</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{fmtDate(e.date)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-medium">
                        {EXPENSE_CATEGORY_LABELS[e.category] ?? e.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate whitespace-nowrap text-foreground/80">
                      {e.description ?? "—"}
                    </TableCell>
                    <TableCell>
                      {e.asset ? (
                        <Link
                          href={`/assets/${e.asset.id}`}
                          className="text-brand hover:underline"
                        >
                          {e.asset.name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{e.vendor ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <MoneyDisplay value={e.amount} currency={currency} />
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
