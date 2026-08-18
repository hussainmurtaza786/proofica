"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Package,
  Users,
  ClipboardCheck,
  Banknote,
  Receipt,
  Wallet,
  Wrench,
  BarChart3,
  Bell,
  Settings,
  ShieldCheck,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { roleCanAccessModule } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  module: string;
  children?: { href: string; label: string }[];
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, module: "dashboard" },
  {
    href: "/rentals",
    label: "Rentals",
    icon: CalendarDays,
    module: "rentals",
    children: [
      { href: "/rentals", label: "All Rentals" },
      { href: "/rentals/calendar", label: "Calendar" },
      { href: "/rentals/overdue", label: "Overdue" },
    ],
  },
  { href: "/assets", label: "Assets", icon: Package, module: "assets" },
  { href: "/customers", label: "Customers", icon: Users, module: "customers" },
  { href: "/inspections", label: "Inspections", icon: ClipboardCheck, module: "inspections" },
  { href: "/payments", label: "Payments", icon: Banknote, module: "payments" },
  { href: "/expenses", label: "Expenses", icon: Receipt, module: "expenses" },
  { href: "/budgets", label: "Budgets", icon: Wallet, module: "budgets" },
  { href: "/maintenance", label: "Maintenance", icon: Wrench, module: "maintenance" },
  { href: "/reports", label: "Reports", icon: BarChart3, module: "reports" },
  { href: "/notifications", label: "Notifications", icon: Bell, module: "dashboard" },
  { href: "/settings", label: "Settings", icon: Settings, module: "settings" },
];

export function Sidebar({
  role,
  orgName,
  unreadNotifications,
}: {
  role: string;
  orgName: string;
  unreadNotifications: number;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleNav = NAV.filter((item) => roleCanAccessModule(role, item.module));

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === href || pathname === "/";
    return pathname.startsWith(href);
  }

  const navContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 pb-6 pt-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-brand-foreground">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Proofica</p>
          <p className="truncate text-xs text-muted-foreground">Protect every rental with proof</p>
        </div>
      </div>

      <div className="mx-5 mb-4 rounded-lg bg-muted px-3 py-2 ring-1 ring-border">
        <p className="truncate text-xs font-medium text-muted-foreground">{orgName}</p>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {visibleNav.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <div key={item.href}>
              <Link
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                  active ? "bg-brand/10 text-brand" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.href === "/notifications" && unreadNotifications > 0 && (
                  <Badge className="bg-brand text-brand-foreground">{unreadNotifications}</Badge>
                )}
              </Link>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-border px-5 py-4">
        <p className="text-xs text-muted-foreground">Signed in as {role}</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden w-60 shrink-0 border-r border-border bg-card lg:block">
        <div className="sticky top-0 h-screen">{navContent}</div>
      </aside>

      {/* Mobile */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-brand-foreground">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold text-foreground">Proofica</span>
        </div>
        <button type="button" onClick={() => setMobileOpen(!mobileOpen)} className="rounded-lg p-2 hover:bg-muted">
          {mobileOpen ? <X className="h-5 w-5 text-muted-foreground" /> : <Menu className="h-5 w-5 text-muted-foreground" />}
        </button>
      </div>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-card shadow-xl">{navContent}</div>
        </div>
      )}
    </>
  );
}
