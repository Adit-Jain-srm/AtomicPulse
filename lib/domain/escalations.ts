import "server-only";
import { v4 as uuid } from "uuid";
import { eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { postAdaptiveCard } from "@/lib/integrations/teams";
import { sendOutlookMail } from "@/lib/integrations/outlook";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Sweeps all orgs and raises an escalation_event for any rule whose trigger has matched
 * but no open event exists yet for the same (rule, target, entity).
 *
 * - no_submit: sheet still in 'draft' or 'reopened' beyond `cycle.opensAt + thresholdDays`
 * - no_approve: sheet 'submitted'/'in_review' for > thresholdDays
 * - no_checkin: window open; no `check_in` row created by employee within thresholdDays of opensAt
 */
export async function runEscalationSweep(): Promise<{ raised: number; notified: number }> {
  const db = getDb();
  const rules = await db.select().from(schema.escalationRule).where(eq(schema.escalationRule.isActive, true));
  if (!rules.length) return { raised: 0, notified: 0 };

  const orgIds = Array.from(new Set(rules.map((r) => r.orgId)));
  const cycles = await db.select().from(schema.goalCycle).where(inArray(schema.goalCycle.orgId, orgIds));
  const sheets = cycles.length
    ? await db
        .select()
        .from(schema.goalSheet)
        .where(inArray(schema.goalSheet.cycleId, cycles.map((c) => c.id)))
    : [];
  const windows = cycles.length
    ? await db
        .select()
        .from(schema.checkInWindow)
        .where(inArray(schema.checkInWindow.cycleId, cycles.map((c) => c.id)))
    : [];
  const goals = sheets.length
    ? await db
        .select()
        .from(schema.goal)
        .where(inArray(schema.goal.sheetId, sheets.map((s) => s.id)))
    : [];
  const checkIns = goals.length
    ? await db
        .select()
        .from(schema.checkIn)
        .where(inArray(schema.checkIn.goalId, goals.map((g) => g.id)))
    : [];
  const allUsers = await db.select().from(schema.user).where(inArray(schema.user.orgId, orgIds));

  const userMap = new Map(allUsers.map((u) => [u.id, u]));
  const cycleMap = new Map(cycles.map((c) => [c.id, c]));

  const now = Date.now();
  let raised = 0;
  let notified = 0;

  // Existing events to dedupe
  const existing = await db
    .select()
    .from(schema.escalationEvent)
    .where(inArray(schema.escalationEvent.status, ["open", "notified"]));
  const seen = new Set(existing.map((e) => `${e.ruleId}|${e.targetUserId}|${e.entityRef}`));

  for (const rule of rules) {
    const orgSheets = sheets.filter((s) => {
      const c = cycleMap.get(s.cycleId);
      return c?.orgId === rule.orgId;
    });
    const thresholdMs = rule.thresholdDays * DAY;

    if (rule.trigger === "no_submit") {
      for (const s of orgSheets) {
        if (s.status !== "draft" && s.status !== "reopened") continue;
        const cycle = cycleMap.get(s.cycleId);
        if (!cycle) continue;
        if (now - cycle.opensAt.getTime() < thresholdMs) continue;
        const ref = `goal_sheet:${s.id}`;
        const key = `${rule.id}|${s.ownerId}|${ref}`;
        if (seen.has(key)) continue;
        await raiseEvent(db, rule.id, s.ownerId, ref, userMap.get(s.ownerId)?.displayName);
        seen.add(key);
        raised++;
        notified++;
      }
    } else if (rule.trigger === "no_approve") {
      for (const s of orgSheets) {
        if (s.status !== "submitted" && s.status !== "in_review") continue;
        if (!s.submittedAt) continue;
        if (now - s.submittedAt.getTime() < thresholdMs) continue;
        if (!s.managerId) continue;
        const ref = `goal_sheet:${s.id}`;
        const key = `${rule.id}|${s.managerId}|${ref}`;
        if (seen.has(key)) continue;
        await raiseEvent(db, rule.id, s.managerId, ref, userMap.get(s.managerId)?.displayName);
        seen.add(key);
        raised++;
        notified++;
      }
    } else if (rule.trigger === "no_checkin") {
      const orgWindows = windows.filter((w) => {
        const c = cycleMap.get(w.cycleId);
        return c?.orgId === rule.orgId;
      });
      for (const w of orgWindows) {
        if (now < w.opensAt.getTime() + thresholdMs) continue;
        if (now > w.closesAt.getTime()) continue;
        const owners = orgSheets
          .filter((s) => s.cycleId === w.cycleId && (s.status === "approved" || s.status === "locked"))
          .map((s) => ({ ownerId: s.ownerId, sheetId: s.id, goalIds: goals.filter((g) => g.sheetId === s.id).map((g) => g.id) }));
        for (const o of owners) {
          if (!o.goalIds.length) continue;
          const submitted = checkIns.some((c) => o.goalIds.includes(c.goalId) && c.period === w.period && !!c.employeeSubmittedAt);
          if (submitted) continue;
          const ref = `check_in:${o.sheetId}:${w.period}`;
          const key = `${rule.id}|${o.ownerId}|${ref}`;
          if (seen.has(key)) continue;
          await raiseEvent(db, rule.id, o.ownerId, ref, userMap.get(o.ownerId)?.displayName);
          seen.add(key);
          raised++;
          notified++;
        }
      }
    }
  }

  return { raised, notified };
}

async function raiseEvent(
  db: ReturnType<typeof getDb>,
  ruleId: string,
  targetUserId: string,
  entityRef: string,
  targetName?: string,
) {
  await db.insert(schema.escalationEvent).values({
    id: uuid(),
    ruleId,
    targetUserId,
    entityRef,
    status: "notified",
    notes: `Auto-raised at ${new Date().toISOString()}`,
  });
  // Notify in-app + Teams + Outlook (stubs)
  await db.insert(schema.notification).values({
    id: uuid(),
    userId: targetUserId,
    channel: "in_app",
    type: "escalation",
    title: "Action required",
    body: `Escalation raised for ${entityRef}.`,
    link: "/dashboard",
  });
  await postAdaptiveCard({
    title: "AtomicPulse · action required",
    subtitle: targetName ? `For ${targetName}` : undefined,
    text: `Escalation raised: ${entityRef}`,
    openUrl: { label: "Open AtomicPulse", url: process.env.APP_BASE_URL ?? "http://localhost:3000" },
  });
  await sendOutlookMail({
    to: "stub@example.com",
    subject: "AtomicPulse · action required",
    bodyHtml: `<p>Escalation raised for <code>${entityRef}</code>.</p>`,
  });
}
