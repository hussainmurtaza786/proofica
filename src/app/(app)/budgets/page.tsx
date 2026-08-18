import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/shared/page-header";
import { BudgetForm } from "@/components/budgets/budget-form";
import { MoneyDisplay } from "@/components/shared/money-display";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toDecimal } from "@/lib/decimal";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/services/access";

export const metadata = { title: "Budgets" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function BudgetsPage() {
  const ctx = await requireOrg();
  const year = new Date().getFullYear();

  const budgets = await prisma.budget.findMany({
    where: { orgId: ctx.orgId, year },
    orderBy: { category: "asc" },
  });

  const org = await prisma.organization.findUnique({
    where: { id: ctx.orgId },
    select: { currency: true },
  });
  const currency = org?.currency ?? "PKR";

  const rows = await Promise.all(
    budgets.map(async (b) => {
      const isMonthly = b.period === "monthly" && b.month;
      const gte = isMonthly ? new Date(year, (b.month ?? 1) - 1, 1) : new Date(year, 0, 1);
      const lt = isMonthly ? new Date(year, b.month ?? 1, 1) : new Date(year + 1, 0, 1);
      const agg = await prisma.expense.aggregate({
        where: { orgId: ctx.orgId, category: b.category, date: { gte, lt } },
        _sum: { amount: true },
      });
      const used = agg._sum.amount ?? toDecimal(0);
      const pct = b.amount.greaterThan(0) ? Math.max(0, used.mul(100).div(b.amount).toNumber()) : 0;
      return { budget: b, used, pct };
    })
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budgets"
        description="Set spending limits and get alerted before you exceed them."
        actions={<BudgetForm />}
      />

      {rows.length === 0 ? (
        <Card className="shadow-none border-border">
          <CardContent className="p-0">
            <EmptyState
              title="No budgets set"
              description="Set a monthly or yearly budget to get alerted before you overspend."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ budget, used, pct }) => {
            const progress = Math.min(100, Math.max(0, Math.floor(pct)));
            const threshold = budget.threshold.toNumber();
            const indicatorClass =
              pct >= 100
                ? "[&_[data-slot=progress-indicator]]:bg-red-500"
                : pct >= threshold
                  ? "[&_[data-slot=progress-indicator]]:bg-amber-500"
                  : "";
            const periodLabel =
              budget.period === "monthly"
                ? `${MONTHS[(budget.month ?? 1) - 1]} ${budget.year}`
                : `Yearly ${budget.year}`;
            return (
              <Card key={budget.id} className="shadow-none border-border">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {EXPENSE_CATEGORY_LABELS[budget.category] ?? budget.category}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{periodLabel}</p>
                    </div>
                    <span
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        pct >= 100 ? "text-destructive" : pct >= threshold ? "text-amber-600 dark:text-amber-400" : "text-foreground"
                      )}
                    >
                      {Math.floor(pct)}%
                    </span>
                  </div>
                  <Progress value={progress} className={cn("mt-3 h-2", indicatorClass)} />
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      <MoneyDisplay value={used} currency={currency} />
                      <span className="mx-1 text-muted-foreground/70">of</span>
                      <MoneyDisplay value={budget.amount} currency={currency} />
                    </span>
                    <span className="text-xs text-muted-foreground">Alert at {Number(budget.threshold)}%</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
