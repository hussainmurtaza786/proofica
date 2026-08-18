import { NextRequest } from "next/server";
import { auth } from "@/auth/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

function csvEscape(v: string | number): string {
  const s = String(v);
  // Prevent CSV injection by prefixing dangerous formulas.
  if (/^[=+\-@\t\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return `"${s.replaceAll('"', '""')}"`;
}

function periodRange(period: string): { from?: Date; to?: Date } {
  const now = new Date();
  if (period === "month") return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
  if (period === "last") {
    return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 1) };
  }
  if (period === "year") return { from: new Date(now.getFullYear(), 0, 1), to: now };
  return {};
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const orgId = session?.user?.orgId;
  if (!orgId) return new Response("Unauthorized", { status: 401 });

  // Verify active membership.
  const membership = await prisma.organizationMember.findFirst({
    where: { orgId, userId: session!.user!.id, status: "active" },
  });
  if (!membership) return new Response("Forbidden", { status: 403 });

  const type = req.nextUrl.searchParams.get("type") ?? "revenue";
  const period = req.nextUrl.searchParams.get("period") ?? "month";
  const range = periodRange(period);
  const between: Prisma.DateTimeFilter | undefined = range.from && range.to ? { gte: range.from, lte: range.to } : undefined;

  const filename = `${type}_${period}.csv`;

  if (type === "expenses") {
    const rows = await prisma.expense.findMany({
      where: { orgId, ...(between ? { date: between } : {}) },
      orderBy: { date: "desc" },
    });
    const csv = [
      ["Date", "Category", "Amount", "Asset", "Vendor", "Description"].map(csvEscape).join(","),
      ...rows.map((e) =>
        [e.date.toISOString().slice(0, 10), e.category, e.amount.toFixed(2), e.assetId ?? "", e.vendor ?? "", e.description ?? ""]
          .map(csvEscape)
          .join(",")
      ),
    ].join("\n");
    return new Response("\uFEFF" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const rows = await prisma.payment.findMany({
    where: { orgId, ...(between ? { receivedAt: between } : {}) },
    include: {
      rental: { select: { rentalNo: true, customer: { select: { name: true } }, asset: { select: { name: true } } } },
    },
    orderBy: { receivedAt: "desc" },
  });
  const csv = [
    ["Date", "Rental", "Customer", "Asset", "Type", "Method", "Amount", "Reference"].map(csvEscape).join(","),
    ...rows.map((p) =>
      [
        p.receivedAt.toISOString().slice(0, 10),
        p.rental?.rentalNo ?? "",
        p.rental?.customer?.name ?? "",
        p.rental?.asset?.name ?? "",
        p.type,
        p.method,
        p.amount.toFixed(2),
        p.reference ?? "",
      ]
        .map(csvEscape)
        .join(",")
    ),
  ].join("\n");

  return new Response("\uFEFF" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
