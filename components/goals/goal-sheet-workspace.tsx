"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { toast } from "sonner";
import {
  Sparkles, Save, ArrowLeft, Plus, GripVertical, Trash2, Send,
  CheckCircle2, AlertTriangle, History, MessageCircle, Wand2, Lock,
  ChevronDown, ShieldCheck, Undo2,
} from "lucide-react";
import Link from "next/link";

import type { Session } from "@/lib/auth/session";
import type { DbApprovalEvent, DbGoal, DbGoalSheet, DbThrustArea, DbUser } from "@/lib/db/schema";
import type { UomType } from "@/lib/domain/scoring";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/select";
import { Avatar } from "@/components/ui/avatar";
import { WeightageRing } from "./weightage-ring";
import { UomPicker } from "./uom-picker";
import { GoalSheetDraftSchema } from "@/lib/validation/goal-sheet";
import {
  saveGoalSheetDraft,
  submitGoalSheet,
  approveGoalSheet,
  returnGoalSheet,
  unlockGoalSheet,
} from "@/app/actions/goals";
import { SHEET_STATUS_LABELS, SHEET_STATUS_TONES } from "@/lib/domain/state-machine";
import { cn, fmtDate, fmtRelative } from "@/lib/utils";
import { PageHeader } from "@/components/dashboards/shared";

type EditableGoal = {
  id?: string;
  thrustAreaId: string;
  title: string;
  description: string;
  uomType: UomType;
  targetValue: number | null;
  targetDate: string | null;
  weightageBp: number;
  status: "not_started" | "on_track" | "completed";
  source: "self" | "shared";
  position: number;
};

function toEditable(g: DbGoal): EditableGoal {
  return {
    id: g.id,
    thrustAreaId: g.thrustAreaId,
    title: g.title,
    description: g.description ?? "",
    uomType: g.uomType,
    targetValue: g.targetValue ?? null,
    targetDate: g.targetDate ? new Date(g.targetDate).toISOString() : null,
    weightageBp: g.weightageBp,
    status: g.status,
    source: g.source,
    position: g.position,
  };
}

export function GoalSheetWorkspace({
  session,
  sheet,
  goals: initialGoals,
  owner,
  manager,
  thrustAreas,
  approvalEvents,
}: {
  session: Session;
  sheet: DbGoalSheet;
  goals: DbGoal[];
  owner: DbUser | null;
  manager: DbUser | null;
  thrustAreas: DbThrustArea[];
  approvalEvents: DbApprovalEvent[];
}) {
  const router = useRouter();
  const [goals, setGoals] = React.useState<EditableGoal[]>(() => initialGoals.map(toEditable));
  const [pending, startTransition] = React.useTransition();
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);
  const [showHistory, setShowHistory] = React.useState(false);
  const [returnComment, setReturnComment] = React.useState("");
  const [unlockReason, setUnlockReason] = React.useState("");
  const [aiBusy, setAiBusy] = React.useState(false);

  const isOwner = session.userId === sheet.ownerId;
  const isManagerOfOwner = session.userId === sheet.managerId && session.role === "manager";
  const isAdmin = session.role === "admin";

  const status = sheet.status;
  const editableByOwner = isOwner && (status === "draft" || status === "reopened");
  const editableByManager = (isManagerOfOwner || isAdmin) && (status === "submitted" || status === "in_review");
  const editable = editableByOwner || editableByManager;
  const isLocked = status === "approved" || status === "locked";

  const totalBp = goals.reduce((s, g) => s + g.weightageBp, 0);
  const validation = React.useMemo(() => {
    const issues: string[] = [];
    if (goals.length === 0) issues.push("Add at least one goal.");
    if (goals.length > 8) issues.push("Maximum 8 goals.");
    if (totalBp !== 10000) issues.push(`Total weightage must be 100% (currently ${(totalBp / 100).toFixed(1)}%)`);
    goals.forEach((g, i) => {
      if (g.weightageBp < 1000) issues.push(`Goal #${i + 1}: weightage must be ≥ 10%.`);
      if (!g.title.trim()) issues.push(`Goal #${i + 1}: title required.`);
      if (!g.thrustAreaId) issues.push(`Goal #${i + 1}: pick a thrust area.`);
      if ((g.uomType === "min_num" || g.uomType === "min_pct" || g.uomType === "max_num" || g.uomType === "max_pct") && (g.targetValue == null || isNaN(Number(g.targetValue))))
        issues.push(`Goal #${i + 1}: target value required.`);
      if (g.uomType === "timeline" && !g.targetDate) issues.push(`Goal #${i + 1}: target date required.`);
    });
    return issues;
  }, [goals, totalBp]);

  const canSubmit = isOwner && validation.length === 0 && (status === "draft" || status === "reopened");

  function addGoal() {
    setGoals((g) => {
      const remaining = 10000 - g.reduce((s, x) => s + x.weightageBp, 0);
      const w = Math.max(1000, Math.min(remaining, 1500));
      return [
        ...g,
        {
          thrustAreaId: thrustAreas[0]?.id ?? "",
          title: "",
          description: "",
          uomType: "min_num",
          targetValue: null,
          targetDate: null,
          weightageBp: w,
          status: "not_started",
          source: "self",
          position: g.length,
        },
      ];
    });
  }

  function removeGoal(i: number) {
    setGoals((g) => g.filter((_, idx) => idx !== i));
  }

  function patch(i: number, p: Partial<EditableGoal>) {
    setGoals((g) => g.map((x, idx) => (idx === i ? { ...x, ...p } : x)));
  }

  function autoBalance() {
    if (!goals.length) return;
    const target = 10000;
    const each = Math.floor(target / goals.length / 100) * 100; // round to whole percent
    const remainder = target - each * goals.length;
    setGoals((g) => g.map((x, i) => ({ ...x, weightageBp: each + (i === 0 ? remainder : 0) })));
  }

  async function save() {
    startTransition(async () => {
      const res = await saveGoalSheetDraft({
        sheetId: sheet.id,
        goals: goals.map((g, i) => ({
          id: g.id,
          thrustAreaId: g.thrustAreaId,
          title: g.title,
          description: g.description,
          uomType: g.uomType,
          targetValue: g.targetValue ?? null,
          targetDate: g.targetDate ?? null,
          weightageBp: g.weightageBp,
          position: i,
        })),
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setSavedAt(new Date());
      toast.success("Saved");
      router.refresh();
    });
  }

  async function submit() {
    if (!canSubmit) return;
    // Persist first, then submit
    await save();
    startTransition(async () => {
      const res = await submitGoalSheet({ sheetId: sheet.id });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Submitted to your manager.");
      router.refresh();
    });
  }

  async function approve() {
    startTransition(async () => {
      const res = await approveGoalSheet({ sheetId: sheet.id });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Sheet approved and locked.");
      router.refresh();
    });
  }

  async function returnForRework() {
    if (!returnComment.trim()) {
      toast.error("Add a comment explaining what to revise.");
      return;
    }
    startTransition(async () => {
      const res = await returnGoalSheet({ sheetId: sheet.id, comment: returnComment });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Returned for rework.");
      setReturnComment("");
      router.refresh();
    });
  }

  async function unlock() {
    if (!unlockReason.trim()) {
      toast.error("Provide a reason for unlocking (audit trail).");
      return;
    }
    startTransition(async () => {
      const res = await unlockGoalSheet({ sheetId: sheet.id, reason: unlockReason });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Sheet unlocked.");
      setUnlockReason("");
      router.refresh();
    });
  }

  async function aiGenerateGoal() {
    if (!editable) return;
    setAiBusy(true);
    try {
      const res = await fetch("/api/copilot/skill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skill: "generateSmartGoal",
          input: {
            role: owner?.title ?? owner?.department ?? "Employee",
            department: owner?.department ?? null,
            existingTitles: goals.map((g) => g.title).filter(Boolean),
          },
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error?.message ?? "AI failed");
      const out = j.data as { title: string; description: string; uomType: UomType; target?: number | null; targetDate?: string | null; weightageBp: number; thrustAreaName?: string | null };

      const ta = thrustAreas.find((t) => t.name === out.thrustAreaName) ?? thrustAreas[0];

      setGoals((g) => {
        const remaining = Math.max(1000, 10000 - g.reduce((s, x) => s + x.weightageBp, 0));
        const w = Math.min(out.weightageBp ?? remaining, remaining);
        return [
          ...g,
          {
            thrustAreaId: ta?.id ?? "",
            title: out.title,
            description: out.description,
            uomType: out.uomType,
            targetValue: out.target ?? null,
            targetDate: out.targetDate ?? null,
            weightageBp: w,
            status: "not_started",
            source: "self",
            position: g.length,
          },
        ];
      });
      toast.success("Goal drafted by AI — review and tweak.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI failed");
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <Link href="/goals" className="text-[11px] text-[hsl(var(--fg-muted))] hover:text-[hsl(var(--fg-secondary))]">
              ← All sheets
            </Link>
          </span> as unknown as string
        }
        title={`${owner?.displayName ?? "Goal sheet"} — FY26`}
        description={
          status === "submitted"
            ? `Submitted ${fmtRelative(sheet.submittedAt)}. Manager review pending.`
            : status === "draft"
            ? "Draft. Build, weight, and submit when ready."
            : status === "locked"
            ? `Locked ${fmtRelative(sheet.lockedAt)}. Edits require admin unlock.`
            : status === "reopened"
            ? "Reopened by admin. Edit and re-submit."
            : "In review."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowHistory(true)}>
              <History className="size-4" /> History
            </Button>
            <Badge tone={SHEET_STATUS_TONES[status]}>{SHEET_STATUS_LABELS[status]}</Badge>
          </div>
        }
      />

      {sheet.returnComment && status === "draft" && (
        <Card className="border-[hsl(var(--warn)/0.4)] bg-[hsl(var(--warn)/0.06)]">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="size-5 shrink-0 text-[hsl(var(--warn))]" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Returned for rework</div>
              <div className="mt-0.5 text-xs text-[hsl(var(--fg-secondary))]">{sheet.returnComment}</div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[hsl(var(--border-subtle))] p-4">
            <div className="text-sm font-semibold tracking-tight">Goals</div>
            <div className="flex flex-wrap items-center gap-2">
              {savedAt && (
                <span className="text-xs text-[hsl(var(--fg-muted))]">
                  Saved {fmtRelative(savedAt)}
                </span>
              )}
              {editable && (
                <>
                  <Button variant="ghost" size="sm" onClick={autoBalance} disabled={!goals.length}>
                    Auto-balance
                  </Button>
                  <Button variant="ai" size="sm" onClick={aiGenerateGoal} disabled={aiBusy || goals.length >= 8}>
                    <Sparkles className="size-3.5" />
                    {aiBusy ? "Drafting…" : "AI: Draft a goal"}
                  </Button>
                </>
              )}
            </div>
          </div>
          <CardContent className="p-0">
            {goals.length === 0 && editable && (
              <EmptyState onAdd={addGoal} onAI={aiGenerateGoal} aiBusy={aiBusy} />
            )}

            {goals.length > 0 && (
              <Reorder.Group
                axis="y"
                values={goals}
                onReorder={(g) => editable && setGoals(g.map((x, i) => ({ ...x, position: i })))}
                className="divide-y divide-[hsl(var(--border-subtle))]"
              >
                {goals.map((g, i) => (
                  <Reorder.Item
                    key={g.id ?? `new-${i}`}
                    value={g}
                    drag={editable ? "y" : false}
                    className="bg-[hsl(var(--surface-0))]"
                  >
                    <GoalRow
                      g={g}
                      i={i}
                      thrustAreas={thrustAreas}
                      editable={editable}
                      isLocked={isLocked}
                      onPatch={(p) => patch(i, p)}
                      onRemove={() => removeGoal(i)}
                    />
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            )}

            {editable && goals.length < 8 && goals.length > 0 && (
              <div className="border-t border-[hsl(var(--border-subtle))] p-3">
                <Button variant="ghost" size="sm" onClick={addGoal}>
                  <Plus className="size-4" /> Add goal ({goals.length}/8)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col items-center gap-4 p-5">
              <WeightageRing totalBp={totalBp} size={148} responsive />
              <div className="grid w-full grid-cols-3 gap-1.5 text-center">
                <Tile label="Goals" value={`${goals.length}/8`} ok={goals.length > 0 && goals.length <= 8} />
                <Tile label="Min" value={goals.length ? `${(Math.min(...goals.map((g) => g.weightageBp)) / 100).toFixed(0)}%` : "—"} ok={goals.every((g) => g.weightageBp >= 1000)} />
                <Tile label="Sum" value={`${(totalBp / 100).toFixed(0)}%`} ok={totalBp === 10000} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-2 p-4">
              {validation.length === 0 ? (
                <ValidationOk />
              ) : (
                <ValidationList issues={validation} />
              )}

              <div className="mt-2 grid gap-2">
                {editableByOwner && (
                  <>
                    <Button variant="secondary" onClick={save} disabled={pending}>
                      <Save className="size-4" /> Save draft
                    </Button>
                    <Button variant="primary" onClick={submit} disabled={!canSubmit || pending}>
                      <Send className="size-4" /> Submit for approval
                    </Button>
                  </>
                )}

                {editableByManager && (
                  <>
                    <Button variant="secondary" onClick={save} disabled={pending}>
                      <Save className="size-4" /> Save inline edits
                    </Button>
                    <Button variant="primary" onClick={approve} disabled={pending}>
                      <CheckCircle2 className="size-4" /> Approve & lock
                    </Button>
                    <details className="rounded-md border border-[hsl(var(--border-subtle))]">
                      <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-xs font-medium text-[hsl(var(--fg-secondary))]">
                        Return for rework
                        <ChevronDown className="size-3" />
                      </summary>
                      <div className="space-y-2 p-3 pt-0">
                        <Textarea
                          value={returnComment}
                          onChange={(e) => setReturnComment(e.target.value)}
                          placeholder="What should the employee revise?"
                          rows={3}
                        />
                        <Button variant="destructive" size="sm" className="w-full" onClick={returnForRework} disabled={pending}>
                          <Undo2 className="size-3.5" /> Return
                        </Button>
                      </div>
                    </details>
                  </>
                )}

                {isAdmin && isLocked && (
                  <details className="rounded-md border border-[hsl(var(--border-subtle))]">
                    <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-xs font-medium text-[hsl(var(--fg-secondary))]">
                      <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5" /> Admin: unlock</span>
                      <ChevronDown className="size-3" />
                    </summary>
                    <div className="space-y-2 p-3 pt-0">
                      <Textarea
                        value={unlockReason}
                        onChange={(e) => setUnlockReason(e.target.value)}
                        placeholder="Reason for unlock (audit trail)"
                        rows={2}
                      />
                      <Button variant="secondary" size="sm" className="w-full" onClick={unlock} disabled={pending}>
                        Unlock for editing
                      </Button>
                    </div>
                  </details>
                )}

                {isLocked && !isAdmin && (
                  <div className="flex items-start gap-2 rounded-md bg-[hsl(var(--surface-1))] p-3 text-xs text-[hsl(var(--fg-muted))]">
                    <Lock className="size-3.5 shrink-0 mt-0.5" />
                    Sheet is locked. Contact HR to request changes.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--fg-muted))]">
                Owner & Manager
              </div>
              {owner && (
                <div className="flex items-center gap-2.5">
                  <Avatar name={owner.displayName} size={32} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{owner.displayName}</div>
                    <div className="text-xs text-[hsl(var(--fg-muted))]">{owner.title ?? owner.department ?? "Employee"}</div>
                  </div>
                </div>
              )}
              {manager && (
                <div className="flex items-center gap-2.5">
                  <Avatar name={manager.displayName} size={32} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{manager.displayName}</div>
                    <div className="text-xs text-[hsl(var(--fg-muted))]">{manager.title ?? "Manager"}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AnimatePresence>
        {showHistory && (
          <HistoryDrawer
            events={approvalEvents}
            sheet={sheet}
            onClose={() => setShowHistory(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function GoalRow({
  g, i, thrustAreas, editable, isLocked, onPatch, onRemove,
}: {
  g: EditableGoal;
  i: number;
  thrustAreas: DbThrustArea[];
  editable: boolean;
  isLocked: boolean;
  onPatch: (p: Partial<EditableGoal>) => void;
  onRemove: () => void;
}) {
  const ta = thrustAreas.find((t) => t.id === g.thrustAreaId);
  const sharedReadOnly = g.source === "shared" && editable;

  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <div className={cn("mt-1 flex shrink-0 items-center text-[hsl(var(--fg-muted))]", editable ? "cursor-grab active:cursor-grabbing" : "")}>
        {editable ? <GripVertical className="size-4" /> : <span className="text-xs font-mono">{i + 1}</span>}
      </div>
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {ta && (
            <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider" style={{ backgroundColor: `${ta.color}1A`, color: ta.color }}>
              <span className="size-1.5 rounded-full" style={{ backgroundColor: ta.color }} />
              {ta.name}
            </span>
          )}
          {g.source === "shared" && <Badge tone="info">Shared</Badge>}
        </div>

        {editable ? (
          <Input
            value={g.title}
            disabled={sharedReadOnly}
            placeholder="Goal title — be specific and measurable"
            onChange={(e) => onPatch({ title: e.target.value })}
            className="h-9 text-sm font-medium"
          />
        ) : (
          <div className="text-sm font-medium">{g.title || <em className="text-[hsl(var(--fg-muted))]">Untitled</em>}</div>
        )}

        {editable ? (
          <Textarea
            value={g.description}
            disabled={sharedReadOnly}
            onChange={(e) => onPatch({ description: e.target.value })}
            placeholder="Optional description, KPI definitions, or guardrails"
            rows={2}
            className="text-sm"
          />
        ) : g.description ? (
          <div className="text-xs text-[hsl(var(--fg-secondary))]">{g.description}</div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_1fr_120px_120px]">
          {editable && !sharedReadOnly ? (
            <NativeSelect
              value={g.thrustAreaId}
              onChange={(e) => onPatch({ thrustAreaId: e.target.value })}
            >
              {thrustAreas.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </NativeSelect>
          ) : (
            <ReadOnly label="Thrust" value={ta?.name ?? "—"} />
          )}

          <UomPicker
            value={g.uomType}
            disabled={!editable || sharedReadOnly}
            onChange={(uomType) => onPatch({ uomType })}
          />

          {(g.uomType === "min_num" || g.uomType === "min_pct" || g.uomType === "max_num" || g.uomType === "max_pct") &&
            (editable && !sharedReadOnly ? (
              <Input
                type="number"
                value={g.targetValue ?? ""}
                onChange={(e) => onPatch({ targetValue: e.target.value === "" ? null : Number(e.target.value) })}
                placeholder="Target"
                className="h-9"
              />
            ) : <ReadOnly label="Target" value={g.targetValue?.toString() ?? "—"} />)}

          {g.uomType === "timeline" &&
            (editable && !sharedReadOnly ? (
              <Input
                type="date"
                value={g.targetDate ? g.targetDate.slice(0, 10) : ""}
                onChange={(e) => onPatch({ targetDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
                className="h-9"
              />
            ) : <ReadOnly label="Deadline" value={fmtDate(g.targetDate)} />)}

          {g.uomType === "zero" && <ReadOnly label="Target" value="0" />}

          {editable ? (
            <WeightageInput
              valueBp={g.weightageBp}
              onChange={(v) => onPatch({ weightageBp: v })}
            />
          ) : <ReadOnly label="Weight" value={`${(g.weightageBp / 100).toFixed(0)}%`} />}
        </div>
      </div>

      {editable && !sharedReadOnly && (
        <button
          onClick={onRemove}
          aria-label="Remove goal"
          className="mt-1 grid size-9 shrink-0 place-items-center rounded-md text-[hsl(var(--fg-muted))] hover:bg-[hsl(var(--danger)/0.1)] hover:text-[hsl(var(--danger))] max-md:size-11"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function WeightageInput({ valueBp, onChange }: { valueBp: number; onChange: (bp: number) => void }) {
  const pct = valueBp / 100;
  return (
    <div className="flex h-9 items-center gap-1 rounded-md border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-0))] px-1.5 max-md:h-11">
      <button
        onClick={() => onChange(Math.max(1000, valueBp - 500))}
        className="grid size-8 place-items-center rounded text-[hsl(var(--fg-muted))] hover:bg-[hsl(var(--surface-2))] max-md:size-10"
        aria-label="Decrement"
      >
        −
      </button>
      <input
        type="number"
        value={pct}
        onChange={(e) => onChange(Math.round(Number(e.target.value)) * 100)}
        className="w-full bg-transparent text-center text-sm tabular-nums focus:outline-none"
      />
      <span className="text-xs text-[hsl(var(--fg-muted))]">%</span>
      <button
        onClick={() => onChange(Math.min(10000, valueBp + 500))}
        className="grid size-8 place-items-center rounded text-[hsl(var(--fg-muted))] hover:bg-[hsl(var(--surface-2))] max-md:size-10"
        aria-label="Increment"
      >
        +
      </button>
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex h-9 flex-col justify-center rounded-md bg-[hsl(var(--surface-1))] px-2.5 leading-tight">
      <div className="text-[9px] uppercase tracking-wider text-[hsl(var(--fg-muted))]">{label}</div>
      <div className="text-xs font-medium">{value}</div>
    </div>
  );
}

function Tile({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className={cn(
      "rounded-md border px-2 py-1.5",
      ok
        ? "border-[hsl(var(--success)/0.3)] bg-[hsl(var(--success)/0.06)] text-[hsl(var(--success))]"
        : "border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] text-[hsl(var(--fg-secondary))]"
    )}>
      <div className="text-[9px] uppercase tracking-wider opacity-70">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function ValidationOk() {
  return (
    <div className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--success)/0.08)] px-3 py-2 text-sm text-[hsl(var(--success))]">
      <CheckCircle2 className="size-4" />
      <span className="font-medium">Ready to submit</span>
    </div>
  );
}

function ValidationList({ issues }: { issues: string[] }) {
  return (
    <div className="rounded-md bg-[hsl(var(--warn)/0.08)] p-3 text-xs text-[hsl(var(--warn))]">
      <div className="flex items-center gap-1.5 font-medium">
        <AlertTriangle className="size-3.5" /> {issues.length} {issues.length === 1 ? "issue" : "issues"}
      </div>
      <ul className="mt-1.5 space-y-0.5 leading-relaxed">
        {issues.map((i, idx) => <li key={idx}>· {i}</li>)}
      </ul>
    </div>
  );
}

function EmptyState({ onAdd, onAI, aiBusy }: { onAdd: () => void; onAI: () => void; aiBusy: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-14 text-center">
      <div className="grid size-14 place-items-center rounded-full ai-gradient text-white shadow-lg">
        <Wand2 className="size-6" />
      </div>
      <div className="mt-4 text-base font-semibold">Build your goal sheet</div>
      <div className="mt-1.5 max-w-md text-sm text-[hsl(var(--fg-muted))]">
        Generate SMART goals with the copilot or add them manually. Total weightage must equal 100%.
      </div>
      <div className="mt-5 flex gap-2">
        <Button variant="ai" onClick={onAI} disabled={aiBusy}>
          <Sparkles className="size-4" /> {aiBusy ? "Drafting…" : "Draft with AI"}
        </Button>
        <Button variant="secondary" onClick={onAdd}>
          <Plus className="size-4" /> Add manually
        </Button>
      </div>
    </div>
  );
}

function HistoryDrawer({
  events,
  sheet,
  onClose,
}: {
  events: DbApprovalEvent[];
  sheet: DbGoalSheet;
  onClose: () => void;
}) {
  return (
    <>
      <motion.div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.aside
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 36 }}
        className="fixed right-0 top-0 z-50 flex h-dvh w-full max-w-[420px] flex-col border-l border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-0))] shadow-2xl pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex items-center justify-between border-b border-[hsl(var(--border-subtle))] px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Approval history</div>
            <div className="text-xs text-[hsl(var(--fg-muted))]">{SHEET_STATUS_LABELS[sheet.status]}</div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><ArrowLeft className="size-4" /></Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {events.length === 0 ? (
            <div className="py-8 text-center text-sm text-[hsl(var(--fg-muted))]">No events yet.</div>
          ) : (
            <ol className="relative space-y-3 border-l border-[hsl(var(--border-subtle))] pl-5">
              {events.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[27px] top-1.5 size-3 rounded-full bg-[hsl(var(--accent))] ring-4 ring-[hsl(var(--surface-0))]" />
                  <div className="text-xs font-medium">{e.action.toUpperCase()}</div>
                  <div className="mt-0.5 text-xs text-[hsl(var(--fg-muted))]">{fmtRelative(e.occurredAt)}</div>
                  {e.comment && (
                    <div className="mt-1 rounded-md bg-[hsl(var(--surface-1))] p-2 text-xs leading-relaxed text-[hsl(var(--fg-secondary))]">
                      <MessageCircle className="mr-1 inline size-3" />
                      {e.comment}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </motion.aside>
    </>
  );
}
