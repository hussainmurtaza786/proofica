import { auth } from "@/auth/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { signOutAction } from "@/server/actions/auth";
import { Bell, LogOut, Search } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export async function AppShell({
  children,
  role,
  orgId,
  orgName,
}: {
  children: React.ReactNode;
  role: string;
  orgId: string;
  orgName: string;
}) {
  const session = await auth();
  const unread = await prisma.notification.count({
    where: { orgId, readAt: null },
  });

  return (
    <div className="flex min-h-screen bg-muted/40">
      <Sidebar role={role} orgName={orgName} unreadNotifications={unread} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-2.5 sm:px-6">
          <div className="hidden items-center gap-2 sm:flex">
            <form action="/search" method="get" className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                name="q"
                placeholder="Search…"
                className="h-9 w-64 rounded-lg border border-border bg-muted pl-8 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-brand/50 focus:bg-background"
              />
            </form>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/notifications"
              className="relative rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-brand-foreground">
                  {unread}
                </span>
              )}
            </Link>
            <div className="flex items-center gap-2 border-l border-border pl-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={session?.user?.image ?? undefined} />
                <AvatarFallback className="bg-brand/10 text-brand text-xs">
                  {(session?.user?.name ?? "U").slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-foreground">{session?.user?.name}</p>
                <p className="text-xs text-muted-foreground">{role}</p>
              </div>
              <form action={signOutAction}>
                <button type="submit" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

export { Badge };
