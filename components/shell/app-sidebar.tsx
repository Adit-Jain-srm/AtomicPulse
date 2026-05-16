"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Target,
  CalendarCheck2,
  Users,
  Share2,
  BarChart3,
  Sparkles,
  Settings,
  ScrollText,
  ShieldAlert,
  ChevronsLeft,
  ChevronsRight,
  Sparkle,
} from "lucide-react";
import type { Session } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: Array<Session["role"]>;
  badge?: string;
};

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Goals", href: "/goals", icon: Target, roles: ["employee"] },
  { label: "Goal Sheets", href: "/goals", icon: Target, roles: ["manager", "admin"] },
  { label: "Check-ins", href: "/check-ins", icon: CalendarCheck2 },
  { label: "Team", href: "/team", icon: Users, roles: ["manager", "admin"] },
  { label: "Shared Goals", href: "/shared-goals", icon: Share2 },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Copilot", href: "/copilot", icon: Sparkles, badge: "AI" },
];

const ADMIN_NAV: NavItem[] = [
  { label: "Cycles", href: "/admin/cycles", icon: Settings, roles: ["admin"] },
  { label: "Thrust Areas", href: "/admin/thrust-areas", icon: Target, roles: ["admin"] },
  { label: "Audit Trail", href: "/admin/audit", icon: ScrollText, roles: ["admin"] },
  { label: "Escalations", href: "/admin/escalations", icon: ShieldAlert, roles: ["admin"] },
];

export function AppSidebar({
  session,
  mobile = false,
  onNavigate,
}: {
  session: Session;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const pathname = usePathname();

  const visible = NAV.filter((n) => !n.roles || n.roles.includes(session.role));
  const visibleAdmin = ADMIN_NAV.filter((n) => !n.roles || n.roles.includes(session.role));

  // In the mobile drawer we always render the expanded version
  const isCollapsed = mobile ? false : collapsed;

  const inner = (
    <>
      <div className={cn("flex items-center gap-2.5 px-4 py-4", isCollapsed && "justify-center px-2")}>
        <div className="grid size-8 place-items-center rounded-md ai-gradient text-white shadow">
          <Sparkle className="size-4" />
        </div>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-w-0"
          >
            <div className="truncate text-sm font-semibold tracking-tight">AtomicPulse</div>
            <div className="truncate text-[10px] uppercase tracking-wider text-[hsl(var(--fg-muted))]">
              Goal OS
            </div>
          </motion.div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        <SectionLabel collapsed={isCollapsed} label="Workspace" />
        <ul className="flex flex-col gap-0.5">
          {visible.map((item) => (
            <NavLink
              key={item.label}
              item={item}
              collapsed={isCollapsed}
              active={isActive(pathname, item.href)}
              onNavigate={onNavigate}
            />
          ))}
        </ul>

        {visibleAdmin.length > 0 && (
          <>
            <SectionLabel collapsed={isCollapsed} label="Admin" className="mt-5" />
            <ul className="flex flex-col gap-0.5">
              {visibleAdmin.map((item) => (
                <NavLink
                  key={item.label}
                  item={item}
                  collapsed={isCollapsed}
                  active={isActive(pathname, item.href)}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          </>
        )}
      </nav>

      {!mobile && (
        <div className="border-t border-[hsl(var(--border-subtle))] p-2">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className={cn(
              "flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-xs text-[hsl(var(--fg-muted))] hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--fg-secondary))] transition-colors",
              isCollapsed && "justify-center"
            )}
          >
            {isCollapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
            {!isCollapsed && "Collapse"}
          </button>
        </div>
      )}
    </>
  );

  if (mobile) {
    return <div className="flex h-full min-h-0 flex-1 flex-col">{inner}</div>;
  }

  return (
    <aside
      className={cn(
        "sticky top-0 z-30 hidden h-dvh shrink-0 flex-col border-r border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-0))] transition-[width] duration-300 lg:flex",
        isCollapsed ? "w-[64px]" : "w-[244px]"
      )}
    >
      {inner}
    </aside>
  );
}

function NavLink({
  item,
  collapsed,
  active,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        title={collapsed ? item.label : undefined}
        onClick={onNavigate}
        className={cn(
          "group relative flex h-11 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors lg:h-9",
          active
            ? "bg-[hsl(var(--accent-soft))] text-[hsl(var(--accent))]"
            : "text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--fg-primary))]",
          collapsed && "justify-center px-2"
        )}
      >
        {active && (
          <motion.span
            layoutId="sidebar-active"
            className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-[hsl(var(--accent))]"
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          />
        )}
        <Icon className="size-4 shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
        {!collapsed && item.badge && (
          <span className="ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ai-gradient text-white">
            {item.badge}
          </span>
        )}
      </Link>
    </li>
  );
}

function SectionLabel({
  label,
  collapsed,
  className,
}: {
  label: string;
  collapsed: boolean;
  className?: string;
}) {
  if (collapsed) return <div className={cn("h-px bg-[hsl(var(--border-subtle))] my-2 mx-3", className)} />;
  return (
    <div className={cn("px-2.5 pb-1.5 pt-2 text-[10px] uppercase tracking-wider text-[hsl(var(--fg-muted))]", className)}>
      {label}
    </div>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname.startsWith(href);
}
