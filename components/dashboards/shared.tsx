"use client";
import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  Users,
  Target,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  CalendarCheck2,
  ShieldAlert,
  Sparkles,
  Building2,
  Activity,
  ScrollText,
  Layers,
  Heart,
  BarChart3,
} from "lucide-react";
import Link from "next/link";

/** Serializable icon keys — safe to pass from Server Components. */
export const STAT_ICON_MAP = {
  users: Users,
  target: Target,
  checkCircle2: CheckCircle2,
  alertCircle: AlertCircle,
  fileCheck2: FileCheck2,
  calendarCheck2: CalendarCheck2,
  shieldAlert: ShieldAlert,
  sparkles: Sparkles,
  building2: Building2,
  activity: Activity,
  scrollText: ScrollText,
  layers: Layers,
  heart: Heart,
  barChart3: BarChart3,
} as const;

export type StatIconName = keyof typeof STAT_ICON_MAP;

export function StatCard({
  label,
  value,
  delta,
  hint,
  icon: IconProp,
  iconName,
  tone = "default",
  href,
}: {
  label: string;
  value: React.ReactNode;
  delta?: { value: string; positive?: boolean };
  hint?: string;
  /** Client-only: pass a Lucide component when the parent is already a Client Component. */
  icon?: LucideIcon;
  /** Server-safe: pass a string key resolved inside this Client Component. */
  iconName?: StatIconName;
  tone?: "default" | "ai";
  href?: string;
}) {
  const Icon = iconName ? STAT_ICON_MAP[iconName] : IconProp;

  const inner = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn(
        "card-elev relative overflow-hidden p-5 transition-all",
        href && "cursor-pointer hover:border-[hsl(var(--border-strong))] hover:shadow-lg"
      )}
    >
      {tone === "ai" && (
        <div className="pointer-events-none absolute inset-0 ai-gradient opacity-[0.04]" />
      )}
      <div className="flex items-start justify-between">
        <div className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--fg-muted))]">{label}</div>
        {Icon && (
          <div className={cn(
            "grid size-8 place-items-center rounded-md",
            tone === "ai" ? "ai-gradient text-white" : "bg-[hsl(var(--surface-2))] text-[hsl(var(--fg-secondary))]"
          )}>
            <Icon className="size-4" />
          </div>
        )}
      </div>
      <div className="mt-3 text-3xl font-semibold leading-none tracking-tight tabular-nums">{value}</div>
      {delta && (
        <div className={cn(
          "mt-1.5 inline-flex items-center gap-1 text-xs font-medium",
          delta.positive ? "text-[hsl(var(--success))]" : "text-[hsl(var(--danger))]"
        )}>
          {delta.value}
        </div>
      )}
      {hint && <div className="mt-2 text-xs text-[hsl(var(--fg-muted))]">{hint}</div>}
    </motion.div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-[hsl(var(--fg-muted))]">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
    >
      <div>
        {eyebrow && (
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-[hsl(var(--fg-muted))]">
            {eyebrow}
          </div>
        )}
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm text-[hsl(var(--fg-secondary))]">{description}</p>
        )}
        {children}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </motion.div>
  );
}
