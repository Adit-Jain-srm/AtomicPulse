"use client";
import * as React from "react";
import { useTheme } from "next-themes";
import { Search, Sparkles, Bell, Sun, Moon, Monitor, LogOut, Settings, ChevronDown, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Session } from "@/lib/auth/session";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

function relativeTime(date: string | Date): string {
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const ROLE_TONES = {
  admin: "info",
  manager: "success",
  employee: "neutral",
} as const;

const ROLE_LABEL = {
  admin: "Admin",
  manager: "Manager",
  employee: "Employee",
} as const;

export function Topbar({
  session,
  onOpenPalette,
  onOpenCopilot,
  onOpenMobileNav,
}: {
  session: Session;
  onOpenPalette: () => void;
  onOpenCopilot: () => void;
  onOpenMobileNav?: () => void;
}) {
  const [menu, setMenu] = React.useState(false);
  const [showNotifs, setShowNotifs] = React.useState(false);
  const [unread, setUnread] = React.useState(0);
  const [notifications, setNotifications] = React.useState<any[]>([]);

  React.useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/notifications/stream");
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.type === "initial") {
            setUnread(data.items?.length ?? 0);
            setNotifications(data.items ?? []);
          } else if (data.type === "delta") {
            setUnread((n) => n + (data.items?.length ?? 0));
            setNotifications((prev) => [...(data.items ?? []), ...prev]);
          }
        } catch {}
      };
      es.onerror = () => {
        es?.close();
        setTimeout(() => {
          es = new EventSource("/api/notifications/stream");
        }, 10_000);
      };
    } catch {}
    return () => { es?.close(); };
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-0)/0.85)] px-3 backdrop-blur-md sm:gap-3 sm:px-4 md:px-6">
      {onOpenMobileNav && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open navigation"
          onClick={onOpenMobileNav}
          className="lg:hidden"
        >
          <Menu className="size-4" />
        </Button>
      )}
      <button
        onClick={onOpenPalette}
        className="group flex h-9 flex-1 max-w-[480px] items-center gap-2 rounded-md border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] px-3 text-sm text-[hsl(var(--fg-muted))] transition-colors hover:border-[hsl(var(--border-strong))] hover:text-[hsl(var(--fg-secondary))]"
      >
        <Search className="size-4" />
        <span className="flex-1 truncate text-left max-sm:hidden">Search goals, people, or run an AI skill…</span>
        <span className="flex-1 truncate text-left sm:hidden">Search…</span>
        <kbd className="hidden rounded bg-[hsl(var(--surface-2))] px-1.5 py-0.5 font-mono text-[10px] sm:inline">⌘K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <Button variant="ai" size="sm" onClick={onOpenCopilot} className="hidden md:inline-flex">
          <Sparkles className="size-3.5" /> Copilot
          <kbd className="ml-1 rounded bg-white/20 px-1 py-0 text-[9px] font-mono">⌘J</kbd>
        </Button>
        <div className="relative">
          <Button variant="ghost" size="icon" aria-label="Notifications" onClick={() => setShowNotifs((s) => !s)} className="relative">
            <Bell className="size-4" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-[hsl(var(--danger))] text-[9px] font-bold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Button>
          <AnimatePresence>
            {showNotifs && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowNotifs(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-0))] shadow-xl"
                >
                  <div className="flex items-center justify-between border-b border-[hsl(var(--border-subtle))] px-3 py-2">
                    <span className="text-sm font-medium">Notifications</span>
                    {notifications.length > 0 && (
                      <button
                        onClick={() => { setUnread(0); setNotifications([]); }}
                        className="text-[11px] text-[hsl(var(--fg-muted))] hover:text-[hsl(var(--fg-secondary))]"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="flex items-center justify-center py-10 text-sm text-[hsl(var(--fg-muted))]">
                        No notifications yet
                      </div>
                    ) : (
                      notifications.map((n) => {
                        const content = (
                          <div key={n.id} className="px-3 py-2.5 hover:bg-[hsl(var(--surface-2))] transition-colors">
                            <div className="text-sm font-medium leading-tight">{n.title}</div>
                            {n.body && <div className="mt-0.5 text-xs text-[hsl(var(--fg-muted))]">{n.body}</div>}
                            <div className="mt-1 text-[10px] text-[hsl(var(--fg-muted))]">{relativeTime(n.createdAt)}</div>
                          </div>
                        );
                        return n.link ? (
                          <Link key={n.id} href={n.link} onClick={() => setShowNotifs(false)}>
                            {content}
                          </Link>
                        ) : (
                          <div key={n.id}>{content}</div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
        <ThemeToggle />
        <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />

        <div className="relative">
          <button
            onClick={() => setMenu((m) => !m)}
            className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-[hsl(var(--surface-2))]"
          >
            <Avatar name={session.displayName} size={28} />
            <div className="hidden text-left md:block">
              <div className="flex items-center gap-1.5 text-xs font-medium leading-tight">
                {session.displayName}
                <Badge tone={ROLE_TONES[session.role]} className="text-[9px]">
                  {ROLE_LABEL[session.role]}
                </Badge>
              </div>
              <div className="text-[10px] text-[hsl(var(--fg-muted))]">{session.department ?? session.email}</div>
            </div>
            <ChevronDown className="size-3 text-[hsl(var(--fg-muted))]" />
          </button>
          <AnimatePresence>
            {menu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-0))] p-1.5 shadow-xl"
                >
                  <div className="px-3 py-2.5">
                    <div className="text-sm font-medium">{session.displayName}</div>
                    <div className="truncate text-xs text-[hsl(var(--fg-muted))]">{session.email}</div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <Badge tone={ROLE_TONES[session.role]} className="text-[10px]">
                        {ROLE_LABEL[session.role]}
                      </Badge>
                      <span className="text-[10px] text-[hsl(var(--fg-muted))]">
                        {session.authMode === "demo" ? "Demo session" : "Microsoft SSO"}
                      </span>
                    </div>
                  </div>
                  <Separator />
                  <Link
                    href="/sign-in"
                    onClick={async (e) => {
                      e.preventDefault();
                      await fetch("/api/auth/sign-out", { method: "POST" });
                      window.location.href = "/sign-in";
                    }}
                    className="flex h-9 items-center gap-2 rounded-md px-2.5 text-sm text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-2))]"
                  >
                    <LogOut className="size-4" />
                    {session.authMode === "demo" ? "Switch demo role" : "Sign out"}
                  </Link>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}

function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="size-9" />;
  const next = resolvedTheme === "dark" ? "light" : "dark";
  const Icon = resolvedTheme === "dark" ? Moon : theme === "system" ? Monitor : Sun;
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(next)}
    >
      <Icon className="size-4" />
    </Button>
  );
}
