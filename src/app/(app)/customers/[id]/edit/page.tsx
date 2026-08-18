import type { Metadata } from "next";

import { requireOrg } from "@/services/access";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { CustomerEditForm } from "@/components/customers/customer-edit-form";

export const metadata: Metadata = { title: "Edit Customer" };

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireOrg();

  const [customer, org] = await Promise.all([
    prisma.customer.findFirst({ where: { id, orgId: ctx.orgId } }),
    prisma.organization.findUnique({ where: { id: ctx.orgId } }),
  ]);

  if (!customer) {
    return (
      <div className="space-y-6">
        <PageHeader title="Customer not found" description="This customer does not exist or was removed." />
      </div>
    );
  }

  return (
    <CustomerEditForm
      customer={customer}
      timezone={org?.timezone ?? "UTC"}
      currency={org?.currency ?? "PKR"}
    />
  );
}
