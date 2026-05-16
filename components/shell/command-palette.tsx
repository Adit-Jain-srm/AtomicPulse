"use client";
import * as React from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Target, CalendarCheck2, Users, Share2, BarChart3,
  Sparkles, ScrollText, ShieldAlert, Settings, ArrowRight, Zap,
} from "lucide-react";
import type { Session } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

type Cmd = {
  id: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  onSelect: () => void;
  group: "Navigate" | "AI" | "Actions";
  roles?: Session["role"][];
};

export function CommandPalette({
  session,
  open,
  onOpenChange,
}: {
  session: Session;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");

  const close = () => onOpenChange(false);

  const items: Cmd[] = React.useMemo(
    () => [
      { id: "nav-dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Navigate", onSelect: () => { router.push("/dashboard"); close(); } },
      { id: "nav-goals", label: "Goal Sheets", icon: Target, group: "Navigate", onSelect: () => { router.push("/goals"); close(); } },
      { id: "nav-checkins", label: "Check-ins", icon: CalendarCheck2, group: "Navigate", onSelect: () => { router.push("/check-ins"); close(); } },
      { id: "nav-team", label: "Team", icon: Users, group: "Navigate", roles: ["manager", "admin"], onSelect: () => { router.push("/team"); close(); } },
      { id: "nav-shared", label: "Shared Goals", icon: Share2, group: "Navigate", onSelect: () => { router.push("/shared-goals"); close(); } },
      { id: "nav-analytics", label: "Analytics", icon: BarChart3, group: "Navigate", onSelect: () => { router.push("/analytics"); close(); } },
      { id: "nav-copilot", label: "Open Copilot", icon: Sparkles, group: "Navigate", onSelect: () => { router.push("/copilot"); close(); } },
      { id: "nav-audit", label: "Audit Trail", icon: ScrollText, group: "Navigate", roles: ["admin"], onSelect: () => { router.push("/admin/audit"); close(); } },
      { id: "nav-escal", label: "Escalations", icon: ShieldAlert, group: "Navigate", roles: ["admin"], onSelect: () => { router.push("/admin/escalations"); close(); } },
      { id: "nav-cycles", label: "Cycles", icon: Settings, group: "Navigate", roles: ["admin"], onSelect: () => { router.push("/admin/cycles"); close(); } },

      { id: "ai-generate", label: "Generate SMART goal", hint: "AI · streams structured", icon: Sparkles, group: "AI", onSelect: () => { router.push("/copilot?skill=generateSmartGoal"); close(); } },
      { id: "ai-summary", label: "Summarise this quarter", hint: "AI · streaming", icon: Sparkles, group: "AI", onSelect: () => { router.push("/copilot?skill=summarizeQuarter"); close(); } },
      { id: "ai-risk", label: "Predict completion risk", hint: "AI · structured", icon: Zap, group: "AI", onSelect: () => { router.push("/copilot?skill=predictCompletionRisk"); close(); } },
      { id: "ai-search", label: "Semantic search across goals", hint: "AI · search", icon: Sparkles, group: "AI", onSelect: () => { router.push(`/copilot?skill=semanticSearch&q=${encodeURIComponent(query)}`); close(); } },

      { id: "act-export", label: "Export achievement (CSV)", icon: ArrowRight, group: "Actions", roles: ["manager", "admin"], onSelect: () => { window.location.href = "/api/exports/achievement.csv"; close(); } },
      { id: "act-export-xlsx", label: "Export achievement (XLSX)", icon: ArrowRight, group: "Actions", roles: ["manager", "admin"], onSelect: () => { window.location.href = "/api/exports/achievement.xlsx"; close(); } },
    ],
    [router, query]
  );

  const visible = items.filter((i) => !i.roles || i.roles.includes(session.role));
  const groups = ["Navigate", "AI", "Actions"] as const;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={close}
          />
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed left-1/2 top-[14%] z-50 w-full max-w-[640px] -translate-x-1/2 px-4"
          >
            <Command
              label="Command Palette"
              className="overflow-hidden rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-0))] shadow-2xl"
              onKeyDown={(e) => {
                if (e.key === "Escape") close();
              }}
            >
              <div className="flex items-center gap-3 border-b border-[hsl(var(--border-subtle))] px-4">
                <Sparkles className="size-4 text-[hsl(var(--accent))]" />
                <Command.Input
                  autoFocus
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Type to search, or run an AI skill…"
                  className="h-12 w-full bg-transparent text-sm focus:outline-none placeholder:text-[hsl(var(--fg-muted))]"
                />
                <kbd className="rounded bg-[hsl(var(--surface-2))] px-1.5 py-0.5 font-mono text-[10px] text-[hsl(var(--fg-muted))]">esc</kbd>
              </div>
              <Command.List className="max-h-[480px] overflow-y-auto p-2">
                <Command.Empty className="px-3 py-8 text-center text-sm text-[hsl(var(--fg-muted))]">
                  No results.
                </Command.Empty>
                {groups.map((g) => {
                  const groupItems = visible.filter((i) => i.group === g);
                  if (!groupItems.length) return null;
                  return (
                    <Command.Group key={g} heading={g}>
                      {groupItems.map((it) => {
                        const Icon = it.icon;
                        return (
                          <Command.Item
                            key={it.id}
                            value={`${g} ${it.label} ${it.hint ?? ""}`}
                            onSelect={it.onSelect}
                            className={cn(
                              "flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-sm",
                              "data-[selected=true]:bg-[hsl(var(--accent-soft))] data-[selected=true]:text-[hsl(var(--accent))]"
                            )}
                          >
                            <Icon className="size-4 text-[hsl(var(--fg-muted))] data-[selected=true]:text-[hsl(var(--accent))]" />
                            <span className="flex-1">{it.label}</span>
                            {it.hint && <span className="text-[11px] text-[hsl(var(--fg-muted))]">{it.hint}</span>}
                          </Command.Item>
                        );
                      })}
                    </Command.Group>
                  );
                })}
              </Command.List>
              <div className="flex items-center justify-between border-t border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] px-3 py-1.5 text-[11px] text-[hsl(var(--fg-muted))]">
                <span>↑↓ navigate · ↵ select · esc close</span>
                <span>{session.displayName}</span>
              </div>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
