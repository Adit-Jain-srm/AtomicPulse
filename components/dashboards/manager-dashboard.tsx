"use client";
import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Users, Inbox, CalendarCheck2, Sparkles, ArrowRight, ListChecks, AlertCircle } from "lucide-react";
import type { Session } from "@/lib/auth/session";
import type { DbCheckIn, DbGoal, DbGoalCycle, DbGoalSheet, DbUser } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader, SectionHeader, StatCard } from "./shared";
import { fmtRelative } from "@/lib/utils";
import { SHEET_STATUS_LABELS, SHEET_STATUS_TONES } from "@/lib/domain/state-machine";

export function ManagerDashboard({
  session,
  cycle,
  reports,
  sheets,
  goals,
  checkIns,
}: {
  session: Session;
  cycle: DbGoalCycle | null;
  reports: DbUser[];
  sheets: DbGoalSheet[];
  goals: DbGoal[];
  checkIns: DbCheckIn[];
}) {
  const sheetsByOwner = new Map(sheets.map((s) => [s.ownerId, s]));
  const pendingApprovals = sheets.filter((s) => s.status === "submitted" || s.status === "in_review");
  const lockedSheets = sheets.filter((s) => s.status === "locked" || s.status === "approved");
  const pendingCheckIns = reports.filter((r) => {
    const sheet = sheetsByOwner.get(r.id);
    if (!sheet || (sheet.status !== "locked" && sheet.status !== "approved")) return false;
    const sheetGoals = goals.filter((g) => g.sheetId === sheet.id);
    const submittedQ1 = checkIns.filter(
      (c) => c.period === "Q1" && c.employeeSubmittedAt && sheetGoals.some((g) => g.id === c.goalId)
    );
    return submittedQ1.length > 0 && submittedQ1.every((c) => !c.managerAcknowledgedAt);
  });

  const overallProgress =
    reports.length === 0
      ? 0
      : Math.round((lockedSheets.length / reports.length) * 100);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={cycle ? `${cycle.fyLabel} cycle` : "No active cycle"}
        title={`Team ${session.department ?? ""} — performance briefing`}
        description="Approve, check in, and unblock. The copilot watches the rest."
        actions={
          <Button variant="ai" size="lg" asChild>
            <Link href="/copilot?skill=managerCopilot">
              <Sparkles className="size-4" />
              1:1 Brief
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Direct reports"
          value={reports.length}
          hint={`${lockedSheets.length} approved · ${reports.length - lockedSheets.length} pending`}
          href="/team"
        />
        <StatCard
          icon={Inbox}
          label="Pending approvals"
          value={pendingApprovals.length}
          hint="Sheets awaiting your review"
          tone={pendingApprovals.length > 0 ? "ai" : "default"}
          href="/goals?filter=needs-review"
        />
        <StatCard
          icon={CalendarCheck2}
          label="Q1 check-ins to ack"
          value={pendingCheckIns.length}
          hint="Acknowledge with a comment"
          href="/check-ins"
        />
        <StatCard
          icon={ListChecks}
          label="Sheet completion"
          value={`${overallProgress}%`}
          hint="Approved this cycle"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[hsl(var(--border-subtle))] p-5">
            <SectionHeader title="Approvals queue" description="Open a sheet to review goals inline." />
            {pendingApprovals.length > 0 && (
              <Badge tone="info">
                {pendingApprovals.length} new
              </Badge>
            )}
          </div>
          <CardContent className="p-0">
            {pendingApprovals.length === 0 ? (
              <EmptyApprovals />
            ) : (
              <ul className="divide-y divide-[hsl(var(--border-subtle))]">
                {pendingApprovals.map((s, i) => {
                  const owner = reports.find((r) => r.id === s.ownerId);
                  if (!owner) return null;
                  const sheetGoals = goals.filter((g) => g.sheetId === s.id);
                  const totalBp = sheetGoals.reduce((acc, g) => acc + g.weightageBp, 0);
                  return (
                    <motion.li
                      key={s.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-center gap-4 px-5 py-3.5"
                    >
                      <Avatar name={owner.displayName} size={36} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {owner.displayName}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-[hsl(var(--fg-muted))]">
                          <span>{owner.title ?? owner.department}</span>
                          <span>·</span>
                          <span>{sheetGoals.length} goals · {(totalBp / 100).toFixed(0)}% allocated</span>
                          <span>·</span>
                          <span>submitted {fmtRelative(s.submittedAt)}</span>
                        </div>
                      </div>
                      <Badge tone={SHEET_STATUS_TONES[s.status]}>{SHEET_STATUS_LABELS[s.status]}</Badge>
                      <Button variant="primary" size="sm" asChild>
                        <Link href={`/goals/${s.id}`}>
                          Review <ArrowRight className="size-3.5" />
                        </Link>
                      </Button>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <div className="border-b border-[hsl(var(--border-subtle))] p-5">
            <SectionHeader title="Team progress" description="Approved sheets, by report." />
          </div>
          <CardContent className="space-y-3 p-5">
            {reports.map((r) => {
              const sheet = sheetsByOwner.get(r.id);
              const status = sheet?.status ?? "draft";
              const tone = SHEET_STATUS_TONES[status];
              const sheetGoals = sheet ? goals.filter((g) => g.sheetId === sheet.id) : [];
              const onTrackPct = sheetGoals.length
                ? Math.round((sheetGoals.filter((g) => g.status === "on_track").length / sheetGoals.length) * 100)
                : 0;
              return (
                <Link
                  key={r.id}
                  href={sheet ? `/goals/${sheet.id}` : "/goals"}
                  className="flex items-center gap-3 rounded-md border border-transparent p-2 transition-colors hover:border-[hsl(var(--border-subtle))] hover:bg-[hsl(var(--surface-1))]"
                >
                  <Avatar name={r.displayName} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-sm font-medium">{r.displayName}</div>
                      <Badge tone={tone} className="text-[10px]">
                        {SHEET_STATUS_LABELS[status]}
                      </Badge>
                    </div>
                    <div className="mt-1.5">
                      <Progress
                        value={onTrackPct}
                        tone={onTrackPct > 60 ? "success" : onTrackPct > 30 ? "warn" : "accent"}
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between border-b border-[hsl(var(--border-subtle))] p-5">
          <SectionHeader
            title="Manager Copilot — talking points for your next 1:1s"
            description="AI-generated from this team's goals and last quarter's check-ins. Scoped to your reports only."
          />
          <Badge tone="ai">
            <Sparkles className="size-3" /> Live
          </Badge>
        </div>
        <CardContent className="grid gap-3 p-5 md:grid-cols-2 lg:grid-cols-3">
          {reports.slice(0, 3).map((r) => (
            <div
              key={r.id}
              className="rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-4"
            >
              <div className="flex items-center gap-2.5">
                <Avatar name={r.displayName} size={28} />
                <div className="text-sm font-medium">{r.displayName}</div>
              </div>
              <ul className="mt-2.5 space-y-1.5 text-xs leading-relaxed text-[hsl(var(--fg-secondary))]">
                <li className="flex items-start gap-1.5">
                  <Sparkles className="mt-0.5 size-3 shrink-0 text-[hsl(var(--accent))]" />
                  Acknowledge progress on revenue goal &mdash; they&rsquo;re tracking ahead of plan.
                </li>
                <li className="flex items-start gap-1.5">
                  <AlertCircle className="mt-0.5 size-3 shrink-0 text-[hsl(var(--warn))]" />
                  Probe the timeline goal — last update was 3 weeks ago.
                </li>
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyApprovals() {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]">
        <CalendarCheck2 className="size-5" />
      </div>
      <div className="mt-3 text-sm font-semibold">All clear</div>
      <div className="mt-1 max-w-sm text-xs text-[hsl(var(--fg-muted))]">
        No sheets are awaiting your review. Reports&rsquo; check-ins live under the Check-ins tab.
      </div>
    </div>
  );
}
