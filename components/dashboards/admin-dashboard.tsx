"use client";
import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Users, FileCheck2, CalendarCheck2, ShieldAlert, Sparkles, ArrowRight, Building2, Activity, ScrollText,
} from "lucide-react";
import type { Session } from "@/lib/auth/session";
import type { DbCheckIn, DbGoal, DbGoalCycle, DbGoalSheet, DbUser } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader, SectionHeader, StatCard } from "./shared";

export function AdminDashboard({
  session,
  cycle,
  users,
  sheets,
  goals,
  checkIns,
}: {
  session: Session;
  cycle: DbGoalCycle | null;
  users: DbUser[];
  sheets: DbGoalSheet[];
  goals: DbGoal[];
  checkIns: DbCheckIn[];
}) {
  const employees = users.filter((u) => u.role === "employee");
  const managers = users.filter((u) => u.role === "manager");

  const submittedSheets = sheets.filter((s) => s.status !== "draft");
  const lockedSheets = sheets.filter((s) => s.status === "locked" || s.status === "approved");

  const submittedPct = employees.length ? Math.round((submittedSheets.length / employees.length) * 100) : 0;
  const lockedPct = employees.length ? Math.round((lockedSheets.length / employees.length) * 100) : 0;

  const q1CheckIns = checkIns.filter((c) => c.period === "Q1");
  const q1Submitted = q1CheckIns.filter((c) => c.employeeSubmittedAt).length;
  const q1Acked = q1CheckIns.filter((c) => c.managerAcknowledgedAt).length;
  const q1SubPct = goals.length ? Math.round((q1Submitted / goals.length) * 100) : 0;

  // Manager effectiveness (per-manager check-in ack rate)
  const managerEffectiveness = managers.map((m) => {
    const reportIds = users.filter((u) => u.managerId === m.id).map((u) => u.id);
    const reportSheets = sheets.filter((s) => reportIds.includes(s.ownerId));
    const reportGoalIds = goals.filter((g) => reportSheets.some((s) => s.id === g.sheetId)).map((g) => g.id);
    const ackPct = reportGoalIds.length === 0
      ? 0
      : Math.round((q1CheckIns.filter((c) => reportGoalIds.includes(c.goalId) && c.managerAcknowledgedAt).length /
          reportGoalIds.length) * 100);
    return { manager: m, reportCount: reportIds.length, ackPct };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={cycle ? `${cycle.fyLabel} cycle · ${cycle.status}` : "No active cycle"}
        title="Governance center"
        description="Where the org's goals, check-ins, and policy meet. Audit-ready by default."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" asChild>
              <Link href="/admin/audit">
                <ScrollText className="size-4" /> Audit trail
              </Link>
            </Button>
            <Button variant="ai" size="lg" asChild>
              <Link href="/copilot?skill=summarizeQuarter">
                <Sparkles className="size-4" />
                Org summary
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="People"
          value={users.length}
          hint={`${managers.length} managers · ${employees.length} employees`}
        />
        <StatCard
          icon={FileCheck2}
          label="Goal-sheet submission"
          value={`${submittedPct}%`}
          hint={`${submittedSheets.length}/${employees.length} sheets submitted`}
          tone="ai"
        />
        <StatCard
          icon={Building2}
          label="Approved sheets"
          value={`${lockedPct}%`}
          hint={`${lockedSheets.length} locked`}
        />
        <StatCard
          icon={CalendarCheck2}
          label="Q1 check-ins"
          value={`${q1SubPct}%`}
          hint={`${q1Submitted} submitted · ${q1Acked} acknowledged`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="border-b border-[hsl(var(--border-subtle))] p-5">
            <SectionHeader
              title="Manager effectiveness"
              description="Quarterly check-in acknowledgement rates. Click a row to drill in."
            />
          </div>
          <CardContent className="space-y-3 p-5">
            {managerEffectiveness.map(({ manager, reportCount, ackPct }) => (
              <Link
                key={manager.id}
                href={`/team?manager=${manager.id}`}
                className="flex items-center gap-3 rounded-md border border-transparent p-2 transition-colors hover:border-[hsl(var(--border-subtle))] hover:bg-[hsl(var(--surface-1))]"
              >
                <Avatar name={manager.displayName} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">{manager.displayName}</div>
                    <span className="font-mono text-xs tabular-nums text-[hsl(var(--fg-muted))]">
                      {ackPct}% · {reportCount} reports
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <Progress
                      value={ackPct}
                      tone={ackPct >= 80 ? "success" : ackPct >= 50 ? "warn" : "danger"}
                    />
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <div className="border-b border-[hsl(var(--border-subtle))] p-5">
            <SectionHeader title="Quick controls" description="Common admin actions." />
          </div>
          <CardContent className="space-y-2 p-3">
            <ActionRow
              icon={Activity}
              title="Open Q2 window"
              description="Allow employees to submit Q2 check-ins."
              cta="Open"
              href="/admin/cycles"
            />
            <ActionRow
              icon={ShieldAlert}
              title="Review escalations"
              description="2 open escalations need your eyes."
              cta="Review"
              href="/admin/escalations"
              tone="warn"
            />
            <ActionRow
              icon={ScrollText}
              title="Export achievement"
              description="Generate the cycle CSV / XLSX."
              cta="Export"
              href="/api/exports/achievement.csv"
            />
            <ActionRow
              icon={Building2}
              title="Sync from Microsoft Graph"
              description="Refresh org hierarchy + roles."
              cta="Sync"
              href="/admin/cycles"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ActionRow({
  icon: Icon,
  title,
  description,
  cta,
  href,
  tone = "neutral",
}: {
  icon: any;
  title: string;
  description: string;
  cta: string;
  href: string;
  tone?: "neutral" | "warn";
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-md border border-transparent p-3 transition-colors hover:border-[hsl(var(--border-subtle))] hover:bg-[hsl(var(--surface-1))]"
    >
      <div className={
        tone === "warn"
          ? "grid size-9 place-items-center rounded-md bg-[hsl(var(--warn)/0.1)] text-[hsl(var(--warn))]"
          : "grid size-9 place-items-center rounded-md bg-[hsl(var(--surface-2))] text-[hsl(var(--fg-secondary))]"
      }>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-[hsl(var(--fg-muted))]">{description}</div>
      </div>
      <Badge tone={tone === "warn" ? "warn" : "neutral"}>{cta}</Badge>
    </Link>
  );
}
