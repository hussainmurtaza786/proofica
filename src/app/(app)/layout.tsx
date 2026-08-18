import { requireOrg } from "@/services/access";
import { AppShell } from "@/components/layout/app-shell";
import { runOrgJobs } from "@/services/status-sync";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const ctx = await requireOrg();

  // MVP: run status sync + reminders on app shell requests.
  // Production: move to a scheduled job / cron.
  await runOrgJobs(ctx.orgId);

  return (
    <AppShell role={ctx.role} orgId={ctx.orgId} orgName={ctx.orgName}>
      {children}
    </AppShell>
  );
}
