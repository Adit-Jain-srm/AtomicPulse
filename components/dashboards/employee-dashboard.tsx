"use client";
import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, Target, CalendarCheck2, ArrowRight, Zap, FileCheck2, AlertCircle } from "lucide-react";
import type { Session } from "@/lib/auth/session";
import type { DbCheckIn, DbGoal, DbGoalCycle, DbGoalSheet } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui/status-pill";
import { WeightageRing } from "@/components/goals/weightage-ring";
import { PageHeader, StatCard, SectionHeader } from "./shared";
import { computeScore } from "@/lib/domain/scoring";
import { SHEET_STATUS_LABELS, SHEET_STATUS_TONES } from "@/lib/domain/state-machine";
import { fmtRelative } from "@/lib/utils";

export function EmployeeDashboard({
  session,
  cycle,
  sheet,
  goals,
  checkIns,
}: {
  session: Session;
  cycle: DbGoalCycle | null;
  sheet: DbGoalSheet;
  goals: DbGoal[];
  checkIns: DbCheckIn[];
}) {
  const totalBp = goals.reduce((s, g) => s + g.weightageBp, 0);
  const submitted = goals.length > 0 && totalBp === 10000 && goals.length <= 8;

  const onTrack = goals.filter((g) => g.status === "on_track").length;
  const completed = goals.filter((g) => g.status === "completed").length;
  const notStarted = goals.filter((g) => g.status === "not_started").length;

  const q1CheckIns = checkIns.filter((c) => c.period === "Q1");
  const submittedQ1 = q1CheckIns.filter((c) => c.employeeSubmittedAt).length;
  const q1Pct = goals.length ? Math.round((submittedQ1 / goals.length) * 100) : 0;

  // Aggregate score from completed goals only
  const scoredGoals = goals.map((g) => {
    const sc = computeScore({
      uomType: g.uomType,
      target: g.targetValue,
      targetDate: g.targetDate ? new Date(g.targetDate) : null,
      actual: g.currentActual ?? q1CheckIns.find((c) => c.goalId === g.id)?.actualValue ?? null,
      completionDate: g.actualCompletionDate ? new Date(g.actualCompletionDate) : null,
    });
    return { ...g, score: sc.bp };
  });
  const aggScore =
    scoredGoals.reduce((s, g) => s + (g.score * g.weightageBp) / 10000, 0);
  const overallPct = Math.round(aggScore / 100);

  const heroCta = (() => {
    if (!cycle) return null;
    if (sheet.status === "draft") {
      return { label: goals.length === 0 ? "Draft your goal sheet" : "Continue draft", href: `/goals/${sheet.id}`, ai: true };
    }
    if (sheet.status === "submitted") return { label: "View submitted sheet", href: `/goals/${sheet.id}`, ai: false };
    if (sheet.status === "in_review") return { label: "Awaiting manager review", href: `/goals/${sheet.id}`, ai: false };
    if (sheet.status === "locked" || sheet.status === "approved")
      return { label: "Update Q1 check-in", href: `/check-ins`, ai: true };
    return { label: "Open my goals", href: `/goals/${sheet.id}`, ai: false };
  })();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={cycle ? `${cycle.fyLabel} cycle` : "No active cycle"}
        title={`Hi ${session.displayName.split(" ")[0]} — your goals at a glance`}
        description="Your progress, your check-ins, and what to do next. The copilot has your back."
        actions={
          heroCta && (
            <Button variant={heroCta.ai ? "ai" : "primary"} size="lg" asChild>
              <Link href={heroCta.href}>
                {heroCta.ai && <Sparkles className="size-4" />}
                {heroCta.label}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Target}
          label="Goals"
          value={goals.length}
          hint={`${onTrack} on track · ${completed} completed`}
          href={`/goals/${sheet.id}`}
        />
        <StatCard
          icon={CalendarCheck2}
          label="Q1 check-ins"
          value={`${submittedQ1}/${goals.length || 0}`}
          hint={`${q1Pct}% submitted this quarter`}
          href="/check-ins"
        />
        <StatCard
          icon={Zap}
          label="Composite score"
          value={`${overallPct}%`}
          tone="ai"
          hint="Weighted across goals"
        />
        <StatCard
          icon={FileCheck2}
          label="Sheet status"
          value={SHEET_STATUS_LABELS[sheet.status]}
          hint={sheet.submittedAt ? `Submitted ${fmtRelative(sheet.submittedAt)}` : "Not yet submitted"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[hsl(var(--border-subtle))] p-5">
            <SectionHeader
              title="Your goal sheet"
              description={
                sheet.status === "draft"
                  ? "Build your sheet — total weightage must equal 100%."
                  : "Locked goals · audit-tracked changes"
              }
            />
            <Badge tone={SHEET_STATUS_TONES[sheet.status]}>{SHEET_STATUS_LABELS[sheet.status]}</Badge>
          </div>
          <CardContent className="p-0">
            {goals.length === 0 ? (
              <EmptyGoals sheetId={sheet.id} />
            ) : (
              <ul className="divide-y divide-[hsl(var(--border-subtle))]">
                {goals.map((g, i) => (
                  <motion.li
                    key={g.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-4 px-5 py-3.5"
                  >
                    <div className="grid size-9 place-items-center rounded-md bg-[hsl(var(--surface-2))] text-xs font-semibold tabular-nums">
                      {(g.weightageBp / 100).toFixed(0)}%
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{g.title}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-[hsl(var(--fg-muted))]">
                        <span className="uppercase tracking-wider">{uomLabel(g.uomType)}</span>
                        {g.targetValue != null && <span>· target {g.targetValue}</span>}
                      </div>
                    </div>
                    <StatusPill status={g.status} />
                  </motion.li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <div className="flex items-center justify-between border-b border-[hsl(var(--border-subtle))] p-5">
            <SectionHeader title="Allocation" description="Weightage must total 100%." />
          </div>
          <CardContent className="flex flex-col items-center gap-4 p-6">
            <WeightageRing totalBp={totalBp} size={160} />
            <div className="grid w-full grid-cols-3 gap-2 text-center">
              <Tile label="Goals" value={goals.length} hint="Max 8" tone={goals.length > 8 ? "danger" : "neutral"} />
              <Tile
                label="Min weight"
                value={goals.length ? `${Math.min(...goals.map((g) => g.weightageBp)) / 100}%` : "—"}
                hint="Min 10%"
                tone={goals.some((g) => g.weightageBp < 1000) ? "danger" : "neutral"}
              />
              <Tile
                label="Status"
                value={submitted ? "Valid" : "Pending"}
                hint={submitted ? "Ready" : "Adjust"}
                tone={submitted ? "success" : "warn"}
              />
            </div>
            <Button variant="ai" size="md" className="w-full" asChild>
              <Link href={`/goals/${sheet.id}`}>
                <Sparkles className="size-4" />
                Open editor
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-[hsl(var(--border-subtle))] p-5">
          <SectionHeader
            title="AI insights"
            description="Generated from your goal sheet and recent check-ins."
          />
          <Badge tone="ai">
            <Sparkles className="size-3" /> Live
          </Badge>
        </div>
        <CardContent className="grid gap-3 p-5 md:grid-cols-3">
          <Insight
            icon={AlertCircle}
            title="2 goals at risk"
            body="“Ship Goal Copilot GA” has slipped 2 weeks behind in your last check-in. Consider scoping down or pulling Sana in."
          />
          <Insight
            icon={Zap}
            title="Quick win available"
            body="“Mentor 2 engineers to senior” is closer to done than your status suggests — log progress to lift your composite score by ~6%."
          />
          <Insight
            icon={Sparkles}
            title="Consider a new KPI"
            body="No active goal covers reliability. The copilot suggests adding a Sev-1 incident zero-goal under Quality & Reliability."
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "neutral" | "success" | "warn" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "text-[hsl(var(--success))]"
      : tone === "warn"
      ? "text-[hsl(var(--warn))]"
      : tone === "danger"
      ? "text-[hsl(var(--danger))]"
      : "text-[hsl(var(--fg-primary))]";
  return (
    <div className="rounded-md border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] px-2 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--fg-muted))]">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold tabular-nums ${toneClass}`}>{value}</div>
      {hint && <div className="text-[10px] text-[hsl(var(--fg-muted))]">{hint}</div>}
    </div>
  );
}

function Insight({ icon: Icon, title, body }: { icon: any; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-4">
      <div className="flex items-center gap-2">
        <div className="grid size-7 place-items-center rounded-md ai-gradient text-white">
          <Icon className="size-3.5" />
        </div>
        <div className="text-sm font-medium">{title}</div>
      </div>
      <div className="mt-1.5 text-xs leading-relaxed text-[hsl(var(--fg-secondary))]">{body}</div>
    </div>
  );
}

function EmptyGoals({ sheetId }: { sheetId: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-14 text-center">
      <div className="grid size-14 place-items-center rounded-full ai-gradient text-white shadow-lg">
        <Sparkles className="size-6" />
      </div>
      <div className="mt-4 text-base font-semibold">Let the copilot draft your sheet</div>
      <div className="mt-1.5 max-w-md text-sm text-[hsl(var(--fg-muted))]">
        Describe your role and priorities &mdash; we&rsquo;ll generate 5 SMART goals you can edit, weight, and submit.
      </div>
      <Button variant="ai" size="lg" className="mt-5" asChild>
        <Link href={`/goals/${sheetId}`}>
          <Sparkles className="size-4" /> Start with AI
        </Link>
      </Button>
    </div>
  );
}

function uomLabel(t: DbGoal["uomType"]) {
  switch (t) {
    case "min_num": return "Min · numeric";
    case "min_pct": return "Min · %";
    case "max_num": return "Max · numeric";
    case "max_pct": return "Max · %";
    case "timeline": return "Timeline";
    case "zero": return "Zero-based";
  }
}
