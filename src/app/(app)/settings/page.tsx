import type { Metadata } from "next";

import { requireOrg, can } from "@/services/access";
import { prisma } from "@/lib/prisma";
import { getOrgSettings } from "@/services/settings";
import { PERMISSIONS } from "@/lib/constants";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrganizationForm, RentalRulesForm, InspectionSettingsForm, CurrencySettingsForm, TeamForm } from "@/components/settings/settings-forms";
import { removeTeamMember } from "@/server/actions/settings";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await requireOrg();

  const [org, settings, members] = await Promise.all([
    prisma.organization.findUnique({ where: { id: ctx.orgId } }),
    getOrgSettings(ctx.orgId),
    prisma.organizationMember.findMany({
      where: { orgId: ctx.orgId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { role: "asc" },
    }),
  ]);

  if (!org) return <p className="py-16 text-center text-sm text-muted-foreground">Organization not found.</p>;

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Organization profile, rental rules, inspection policy and team." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Organization</CardTitle>
          </CardHeader>
          <CardContent>
            {can(ctx, PERMISSIONS.manageSettings) ? (
              <OrganizationForm
                org={{
                  name: org.name,
                  businessType: org.businessType,
                  currency: org.currency,
                  timezone: org.timezone,
                  address: org.address,
                  phone: org.phone,
                  email: org.email,
                }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">You don&apos;t have permission to edit settings.</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Rental rules</CardTitle>
          </CardHeader>
          <CardContent>
            {can(ctx, PERMISSIONS.manageSettings) ? (
              <RentalRulesForm rules={settings.rentalRules as unknown as Record<string, unknown>} />
            ) : (
              <p className="text-sm text-muted-foreground">You don&apos;t have permission to edit rental rules.</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Inspection settings</CardTitle>
          </CardHeader>
          <CardContent>
            {can(ctx, PERMISSIONS.manageSettings) ? (
              <InspectionSettingsForm settings={settings.inspectionSettings} />
            ) : (
              <p className="text-sm text-muted-foreground">You don&apos;t have permission to edit inspection settings.</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Currency display</CardTitle>
          </CardHeader>
          <CardContent>
            {can(ctx, PERMISSIONS.manageSettings) ? (
              <CurrencySettingsForm settings={settings.currencySettings} />
            ) : (
              <p className="text-sm text-muted-foreground">You don&apos;t have permission to edit currency settings.</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Team</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {can(ctx, PERMISSIONS.manageUsers) && <TeamForm />}
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {m.user.name} {m.userId === ctx.userId && <span className="text-muted-foreground">(you)</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.user.email} · <span className="font-medium text-muted-foreground">{m.role}</span>
                    </p>
                  </div>
                  {can(ctx, PERMISSIONS.manageUsers) && m.status === "active" && !(m.role === "Owner" && m.userId === ctx.userId) && (
                    <form action={removeTeamMember.bind(null, { ok: false }) as unknown as (fd: FormData) => void}>
                      <input type="hidden" name="memberId" value={m.id} />
                      <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground hover:text-red-500 dark:hover:text-red-400">
                        Disable
                      </Button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
