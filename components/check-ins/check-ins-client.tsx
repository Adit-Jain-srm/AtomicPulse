"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Save, Send, CheckCircle2, MessageCircle, CalendarCheck2, Sparkles, Lock, Activity, Circle,
} from "lucide-react";
import type { Session } from "@/lib/auth/session";
import type { DbCheckIn, DbCheckInWindow, DbGoal, DbGoalSheet, DbUser } from "@/lib/db/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { Period } from "@/lib/domain/windows";
import { ALL_PERIODS, periodLabel, isWindowOpen } from "@/lib/domain/windows";
import { computeScore } from "@/lib/domain/scoring";
import { fmtRelative, cn } from "@/lib/utils";
import { upsertCheckIn, acknowledgeCheckIn } from "@/app/actions/check-ins";

type Editable = {
  goalId: string;
  status: "not_started" | "on_track" | "completed";
  actualValue: number | null;
  completionDate: string | null;
  employeeNote: string;
  managerComment: string;
  checkInId?: string;
  employeeSubmittedAt?: Date | null;
  managerAcknowledgedAt?: Date | null;
};

export function CheckInsClient({
  session,
  period,
  windows,
  goals,
  sheet,
  checkIns,
  owner,
  mode,
}: {
  session: Session;
  period: Period;
  windows: DbCheckInWindow[];
  goals: DbGoal[];
  sheet: DbGoalSheet;
  checkIns: DbCheckIn[];
  owner: DbUser | null;
  mode: "self" | "manager";
}) {
  const router = useRouter();
  const [activePeriod, setActivePeriod] = React.useState<Period>(period);
  const [pending, startTransition] = React.useTransition();

  const [entries, setEntries] = React.useState<Record<string, Editable>>(() => buildEntries(goals, checkIns, activePeriod));

  React.useEffect(() => {
    setEntries(buildEntries(goals, checkIns, activePeriod));
  }, [activePeriod, goals, checkIns]);

  const window = windows.find((w) => w.period === activePeriod) ?? null;
  const open = isWindowOpen(window);
  const isLockedSheet = sheet.status === "locked" || sheet.status === "approved";
  const submittedCount = Object.values(entries).filter((e) => e.employeeSubmittedAt).length;
  const ackedCount = Object.values(entries).filter((e) => e.managerAcknowledgedAt).length;

  const composite = React.useMemo(() => {
    let total = 0; let weight = 0;
    for (const g of goals) {
      const e = entries[g.id];
      if (!e) continue;
      const sc = computeScore({
        uomType: g.uomType,
        target: g.targetValue,
        targetDate: g.targetDate ?? null,
        actual: e.actualValue,
        completionDate: e.completionDate ? new Date(e.completionDate) : null,
      });
      total += (sc.bp * g.weightageBp) / 10000;
      weight += g.weightageBp;
    }
    return weight > 0 ? Math.round(total / 100) : 0;
  }, [entries, goals]);

  function patch(goalId: string, p: Partial<Editable>) {
    setEntries((prev) => ({ ...prev, [goalId]: { ...prev[goalId], ...p } }));
  }

  async function saveOne(goalId: string, alsoSubmit = false) {
    const e = entries[goalId];
    if (!e) return;
    startTransition(async () => {
      const res = await upsertCheckIn({
        goalId,
        period: activePeriod,
        status: e.status,
        actualValue: e.actualValue,
        completionDate: e.completionDate,
        employeeNote: e.employeeNote,
        markSubmitted: alsoSubmit,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(alsoSubmit ? "Submitted" : "Saved");
      router.refresh();
    });
  }

  async function ackOne(goalId: string) {
    const e = entries[goalId];
    if (!e?.checkInId) {
      toast.error("Employee hasn't submitted yet.");
      return;
    }
    if (!e.managerComment.trim()) {
      toast.error("Add a comment to acknowledge.");
      return;
    }
    startTransition(async () => {
      const res = await acknowledgeCheckIn({ checkInId: e.checkInId!, comment: e.managerComment });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Acknowledged");
      router.refresh();
    });
  }

  if (!isLockedSheet && mode === "self") {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <Lock className="mx-auto size-9 text-[hsl(var(--fg-muted))]" />
          <div className="mt-3 text-base font-semibold">Sheet not yet approved</div>
          <div className="mt-1 max-w-md mx-auto text-sm text-[hsl(var(--fg-muted))]">
            Check-ins open after your manager approves your goal sheet. The current sheet is in <strong>{sheet.status}</strong>.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {ALL_PERIODS.map((p) => {
              const w = windows.find((x) => x.period === p);
              const isOpen = isWindowOpen(w);
              return (
                <button
                  key={p}
                  onClick={() => setActivePeriod(p)}
                  className={cn(
                    "inline-flex min-h-10 items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                    activePeriod === p
                      ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent-soft))] text-[hsl(var(--accent))]"
                      : "border-[hsl(var(--border-subtle))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-1))]"
                  )}
                >
                  {p}
                  {isOpen && <Badge tone="success" className="ml-0.5 text-[9px]">Open</Badge>}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[hsl(var(--fg-muted))]">
            <div>{periodLabel(activePeriod)}</div>
            {window && (
              <div>
                Closes {window.closesAt.toLocaleDateString()}
              </div>
            )}
            <div className="rounded-md bg-[hsl(var(--surface-2))] px-2 py-1 font-mono text-[hsl(var(--fg-primary))]">
              {composite}% composite
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3">
        {goals.map((g) => {
          const e = entries[g.id];
          if (!e) return null;
          const sc = computeScore({
            uomType: g.uomType,
            target: g.targetValue,
            targetDate: g.targetDate ?? null,
            actual: e.actualValue,
            completionDate: e.completionDate ? new Date(e.completionDate) : null,
          });
          const submitted = !!e.employeeSubmittedAt;
          const acked = !!e.managerAcknowledgedAt;
          const editableSelf = mode === "self" && open && !acked;
          return (
            <Card key={g.id}>
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-md bg-[hsl(var(--surface-2))] text-xs font-semibold tabular-nums">
                    {(g.weightageBp / 100).toFixed(0)}%
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-medium">{g.title}</div>
                      <Badge tone={statusTone(e.status)}>
                        {e.status === "not_started" && <Circle className="size-3" />}
                        {e.status === "on_track" && <Activity className="size-3" />}
                        {e.status === "completed" && <CheckCircle2 className="size-3" />}
                        {labelStatus(e.status)}
                      </Badge>
                      {submitted && <Badge tone="info">Submitted {fmtRelative(e.employeeSubmittedAt)}</Badge>}
                      {acked && <Badge tone="success">Acked {fmtRelative(e.managerAcknowledgedAt)}</Badge>}
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px_140px]">
                      {(g.uomType === "min_num" || g.uomType === "min_pct" || g.uomType === "max_num" || g.uomType === "max_pct") && (
                        <Input
                          type="number"
                          disabled={!editableSelf}
                          placeholder={`Actual (target ${g.targetValue ?? "—"})`}
                          value={e.actualValue ?? ""}
                          onChange={(ev) => patch(g.id, { actualValue: ev.target.value === "" ? null : Number(ev.target.value) })}
                        />
                      )}
                      {g.uomType === "timeline" && (
                        <Input
                          type="date"
                          disabled={!editableSelf}
                          value={e.completionDate ? e.completionDate.slice(0, 10) : ""}
                          onChange={(ev) => patch(g.id, { completionDate: ev.target.value ? new Date(ev.target.value).toISOString() : null })}
                        />
                      )}
                      {g.uomType === "zero" && (
                        <select
                          disabled={!editableSelf}
                          value={e.actualValue === 0 ? "0" : e.actualValue == null ? "" : "1"}
                          onChange={(ev) => patch(g.id, { actualValue: ev.target.value === "0" ? 0 : ev.target.value === "1" ? 1 : null })}
                          className="h-9 rounded-md border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-0))] px-2 text-sm focus-ring"
                        >
                          <option value="">—</option>
                          <option value="0">Achieved (zero)</option>
                          <option value="1">Did not achieve</option>
                        </select>
                      )}

                      <select
                        disabled={!editableSelf}
                        value={e.status}
                        onChange={(ev) => patch(g.id, { status: ev.target.value as any })}
                        className="h-9 rounded-md border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-0))] px-2 text-sm focus-ring"
                      >
                        <option value="not_started">Not started</option>
                        <option value="on_track">On track</option>
                        <option value="completed">Completed</option>
                      </select>

                      <div className="flex items-center justify-end gap-2 text-xs tabular-nums">
                        <span className="text-[hsl(var(--fg-muted))]">Score</span>
                        <span className="font-semibold">{(sc.bp / 100).toFixed(0)}%</span>
                      </div>
                    </div>

                    <Textarea
                      disabled={!editableSelf}
                      value={e.employeeNote}
                      onChange={(ev) => patch(g.id, { employeeNote: ev.target.value })}
                      placeholder={mode === "self" ? "Optional note (what's working / what's blocked)" : "Employee's note"}
                      rows={2}
                      className="mt-3 text-sm"
                    />

                    {mode === "manager" && (
                      <div className="mt-3 rounded-md border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-3">
                        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--fg-muted))]">
                          <MessageCircle className="size-3" /> Manager comment
                        </div>
                        <Textarea
                          value={e.managerComment}
                          onChange={(ev) => patch(g.id, { managerComment: ev.target.value })}
                          placeholder="Acknowledge progress, name a blocker, or commit to a follow-up."
                          rows={2}
                          disabled={acked}
                        />
                        {!acked && (
                          <div className="mt-2 flex justify-end">
                            <Button variant="primary" onClick={() => ackOne(g.id)} disabled={pending || !e.checkInId} className="min-h-10">
                              <CheckCircle2 className="size-3.5" /> Acknowledge
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {mode === "self" && editableSelf && (
                      <div className="mt-3 flex justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={() => saveOne(g.id, false)} disabled={pending}>
                          <Save className="size-3.5" /> Save
                        </Button>
                        <Button variant="primary" size="sm" onClick={() => saveOne(g.id, true)} disabled={pending}>
                          <Send className="size-3.5" /> Submit
                        </Button>
                      </div>
                    )}

                    <div className="mt-3">
                      <Progress
                        value={Math.min(100, sc.bp / 100)}
                        tone={sc.bp >= 8000 ? "success" : sc.bp >= 4000 ? "warn" : "danger"}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!open && (
        <Card className="border-[hsl(var(--warn)/0.4)] bg-[hsl(var(--warn)/0.06)]">
          <CardContent className="flex items-start gap-3 p-4">
            <Lock className="size-4 mt-0.5 text-[hsl(var(--warn))]" />
            <div className="text-xs text-[hsl(var(--fg-secondary))]">
              The {activePeriod} window is closed. Edits are read-only.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function statusTone(s: Editable["status"]) {
  return s === "completed" ? "success" : s === "on_track" ? "info" : "neutral";
}
function labelStatus(s: Editable["status"]) {
  return s === "completed" ? "Completed" : s === "on_track" ? "On track" : "Not started";
}

function buildEntries(goals: DbGoal[], checkIns: DbCheckIn[], period: Period): Record<string, Editable> {
  const out: Record<string, Editable> = {};
  for (const g of goals) {
    const c = checkIns.find((c) => c.goalId === g.id && c.period === period);
    out[g.id] = {
      goalId: g.id,
      status: c?.status ?? g.status,
      actualValue: c?.actualValue ?? null,
      completionDate: c?.completionDate ? new Date(c.completionDate).toISOString() : null,
      employeeNote: c?.employeeNote ?? "",
      managerComment: c?.managerComment ?? "",
      checkInId: c?.id,
      employeeSubmittedAt: c?.employeeSubmittedAt ?? null,
      managerAcknowledgedAt: c?.managerAcknowledgedAt ?? null,
    };
  }
  return out;
}
