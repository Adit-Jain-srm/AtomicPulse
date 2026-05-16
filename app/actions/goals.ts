"use server";
import { v4 as uuid } from "uuid";
import { revalidateTag, revalidatePath } from "next/cache";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guards";
import {
  GoalSheetDraftSchema,
  GoalDraftSchema,
  ApproveSheetSchema,
  ReturnSheetSchema,
  UnlockSheetSchema,
  PushSharedGoalSchema,
} from "@/lib/validation/goal-sheet";
import { canTransition, nextStatus } from "@/lib/domain/state-machine";
import { recordAudit } from "@/lib/domain/audit";

type Result<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string; fields?: Record<string, string> } };

function fail(code: string, message: string, fields?: Record<string, string>): Result<never> {
  return { ok: false, error: { code, message, fields } };
}

async function notify(userId: string | null, payload: {
  type: string; title: string; body: string; link?: string; channel?: "in_app" | "email" | "teams";
}) {
  if (!userId) return;
  const db = getDb();
  await db.insert(schema.notification).values({
    id: uuid(),
    userId,
    channel: payload.channel ?? "in_app",
    type: payload.type,
    title: payload.title,
    body: payload.body,
    link: payload.link ?? null,
  });
}

export async function saveGoalSheetDraft(input: { sheetId: string; goals: z.infer<typeof GoalDraftSchema>[] }): Promise<Result<{ sheetId: string }>> {
  const session = await getSession();
  if (!session) return fail("unauthenticated", "Sign in to continue.");

  // For draft saves we don't enforce the strict 100% rule (employee may be mid-edit).
  const partial = z.object({
    sheetId: z.string().min(1),
    goals: z.array(GoalDraftSchema).max(8, "Maximum 8 goals."),
  }).safeParse(input);
  if (!partial.success) return fail("validation", partial.error.issues.map((i) => i.message).join("; "));

  const db = getDb();
  const sheet = (await db.select().from(schema.goalSheet).where(eq(schema.goalSheet.id, input.sheetId)).limit(1))[0];
  if (!sheet) return fail("not_found", "Goal sheet not found.");

  try {
    await requirePermission(session, "goalSheet.update", { ownerId: sheet.ownerId, orgId: session.orgId });
  } catch {
    return fail("forbidden", "You can only edit your own draft sheet.");
  }

  if (!(sheet.status === "draft" || sheet.status === "reopened")) {
    return fail("conflict", `Cannot edit a ${sheet.status} sheet without admin unlock.`);
  }

  const existingGoals = await db.select().from(schema.goal).where(eq(schema.goal.sheetId, sheet.id));
  const incomingIds = new Set(input.goals.filter((g) => g.id).map((g) => g.id!));
  const toDelete = existingGoals.filter((g) => !incomingIds.has(g.id));

  // Audit deletes
  for (const g of toDelete) {
    await recordAudit({
      orgId: session.orgId,
      entityType: "goal",
      entityId: g.id,
      actorId: session.userId,
      action: "delete",
      before: g,
    });
  }
  if (toDelete.length) {
    await db.delete(schema.goal).where(inArray(schema.goal.id, toDelete.map((g) => g.id)));
  }

  let total = 0;
  for (const [i, g] of input.goals.entries()) {
    total += g.weightageBp;
    if (g.id) {
      const before = existingGoals.find((e) => e.id === g.id);

      // Shared goals: only weightageBp and position are mutable. Silently coerce
      // any drift on other fields and audit the dropped attempts so the UI still
      // saves the legitimate weight change.
      if (before?.source === "shared") {
        const dropped: string[] = [];
        if (g.thrustAreaId !== before.thrustAreaId) dropped.push("thrustAreaId");
        if (g.title !== before.title) dropped.push("title");
        if ((g.description ?? null) !== (before.description ?? null)) dropped.push("description");
        if (g.uomType !== before.uomType) dropped.push("uomType");
        if ((g.targetValue ?? null) !== (before.targetValue ?? null)) dropped.push("targetValue");
        const incomingTd = g.targetDate ? new Date(g.targetDate).getTime() : null;
        const beforeTd = before.targetDate ? new Date(before.targetDate).getTime() : null;
        if (incomingTd !== beforeTd) dropped.push("targetDate");

        await db
          .update(schema.goal)
          .set({ weightageBp: g.weightageBp, position: i, updatedAt: new Date() })
          .where(eq(schema.goal.id, g.id));

        if (dropped.length) {
          await recordAudit({
            orgId: session.orgId,
            entityType: "goal",
            entityId: g.id,
            actorId: session.userId,
            action: "shared_field_blocked",
            after: { droppedFields: dropped },
          });
        }
        continue;
      }

      await db
        .update(schema.goal)
        .set({
          thrustAreaId: g.thrustAreaId,
          title: g.title,
          description: g.description ?? null,
          uomType: g.uomType,
          targetValue: g.targetValue ?? null,
          targetDate: g.targetDate ? new Date(g.targetDate) : null,
          weightageBp: g.weightageBp,
          position: i,
          updatedAt: new Date(),
        })
        .where(eq(schema.goal.id, g.id));
      const after = (await db.select().from(schema.goal).where(eq(schema.goal.id, g.id)).limit(1))[0];
      if (sheet.lockedAt && before) {
        await recordAudit({
          orgId: session.orgId, entityType: "goal", entityId: g.id, actorId: session.userId,
          action: "update_post_lock", before, after,
        });
      }
    } else {
      const id = uuid();
      await db.insert(schema.goal).values({
        id,
        sheetId: sheet.id,
        thrustAreaId: g.thrustAreaId,
        title: g.title,
        description: g.description ?? null,
        uomType: g.uomType,
        targetValue: g.targetValue ?? null,
        targetDate: g.targetDate ? new Date(g.targetDate) : null,
        weightageBp: g.weightageBp,
        position: i,
      });
      await recordAudit({
        orgId: session.orgId, entityType: "goal", entityId: id, actorId: session.userId,
        action: "create", after: { ...g, id, sheetId: sheet.id },
      });
    }
  }

  await db
    .update(schema.goalSheet)
    .set({ totalWeightageBp: total, updatedAt: new Date() })
    .where(eq(schema.goalSheet.id, sheet.id));

  // Primary → linked propagation. If the saver edited any non-shared goal whose
  // achievement state moved (currentActual / actualCompletionDate / status), fan
  // the new values out to every linked recipient through syncSharedAchievement.
  const updatedGoals = await db.select().from(schema.goal).where(eq(schema.goal.sheetId, sheet.id));
  for (const updated of updatedGoals) {
    if (updated.source === "shared") continue;
    const before = existingGoals.find((e) => e.id === updated.id);
    if (!before) continue;
    const beforeCompletion = before.actualCompletionDate?.getTime() ?? null;
    const afterCompletion = updated.actualCompletionDate?.getTime() ?? null;
    if (
      before.currentActual !== updated.currentActual ||
      beforeCompletion !== afterCompletion ||
      before.status !== updated.status
    ) {
      await syncSharedAchievement(updated.id);
    }
  }

  revalidateTag(`sheet:${sheet.id}`);
  revalidateTag(`user:${sheet.ownerId}`);
  revalidatePath(`/goals/${sheet.id}`);
  revalidatePath(`/dashboard`);

  return { ok: true, data: { sheetId: sheet.id } };
}

export async function submitGoalSheet(input: { sheetId: string }): Promise<Result<{ sheetId: string; status: string }>> {
  const session = await getSession();
  if (!session) return fail("unauthenticated", "Sign in to continue.");
  const db = getDb();
  const sheet = (await db.select().from(schema.goalSheet).where(eq(schema.goalSheet.id, input.sheetId)).limit(1))[0];
  if (!sheet) return fail("not_found", "Sheet not found.");
  try {
    await requirePermission(session, "goalSheet.submit", { ownerId: sheet.ownerId, orgId: session.orgId });
  } catch {
    return fail("forbidden", "Only the owner can submit.");
  }

  const t = canTransition(sheet.status, "submit", session.role);
  if (!t.ok) return fail("conflict", t.reason);

  const goals = await db.select().from(schema.goal).where(eq(schema.goal.sheetId, sheet.id));
  // Strict validation for submission
  const parsed = GoalSheetDraftSchema.safeParse({
    sheetId: sheet.id,
    goals: goals.map((g) => ({
      id: g.id,
      thrustAreaId: g.thrustAreaId,
      title: g.title,
      description: g.description ?? "",
      uomType: g.uomType,
      targetValue: g.targetValue ?? null,
      targetDate: g.targetDate ? new Date(g.targetDate).toISOString() : null,
      weightageBp: g.weightageBp,
    })),
  });
  if (!parsed.success) {
    return fail("validation", parsed.error.issues.map((i) => i.message).join("; "));
  }

  const now = new Date();
  await db
    .update(schema.goalSheet)
    .set({ status: nextStatus(sheet.status, "submit"), submittedAt: now, updatedAt: now })
    .where(eq(schema.goalSheet.id, sheet.id));

  await db.insert(schema.approvalEvent).values({
    id: uuid(), sheetId: sheet.id, actorId: session.userId, action: "submit", comment: null,
  });
  await recordAudit({
    orgId: session.orgId, entityType: "goal_sheet", entityId: sheet.id, actorId: session.userId,
    action: "submit", before: { status: sheet.status }, after: { status: "submitted" },
  });

  if (sheet.managerId) {
    await notify(sheet.managerId, {
      type: "goal_submitted",
      title: `${session.displayName} submitted goals`,
      body: `${goals.length} goals · 100% allocated · awaiting your review`,
      link: `/goals/${sheet.id}`,
    });
  }

  revalidateTag(`sheet:${sheet.id}`);
  revalidateTag(`user:${sheet.ownerId}`);
  revalidatePath(`/goals/${sheet.id}`);
  revalidatePath(`/dashboard`);
  revalidatePath(`/goals`);

  return { ok: true, data: { sheetId: sheet.id, status: "submitted" } };
}

export async function approveGoalSheet(input: z.infer<typeof ApproveSheetSchema>): Promise<Result<{ sheetId: string }>> {
  const parsed = ApproveSheetSchema.safeParse(input);
  if (!parsed.success) return fail("validation", parsed.error.issues.map((i) => i.message).join("; "));
  const session = await getSession();
  if (!session) return fail("unauthenticated", "Sign in to continue.");
  const db = getDb();
  const sheet = (await db.select().from(schema.goalSheet).where(eq(schema.goalSheet.id, input.sheetId)).limit(1))[0];
  if (!sheet) return fail("not_found", "Sheet not found.");
  try {
    await requirePermission(session, "goalSheet.approve", { ownerId: sheet.ownerId, orgId: session.orgId });
  } catch {
    return fail("forbidden", "Only the assigned manager can approve.");
  }
  const t = canTransition(sheet.status, "approve", session.role);
  if (!t.ok) return fail("conflict", t.reason);

  const now = new Date();
  await db
    .update(schema.goalSheet)
    .set({
      status: "locked",
      approvedAt: now,
      lockedAt: now,
      approveComment: input.comment ?? null,
      updatedAt: now,
    })
    .where(eq(schema.goalSheet.id, sheet.id));

  await db.insert(schema.approvalEvent).values({
    id: uuid(), sheetId: sheet.id, actorId: session.userId, action: "approve", comment: input.comment ?? null,
  });
  await recordAudit({
    orgId: session.orgId, entityType: "goal_sheet", entityId: sheet.id, actorId: session.userId,
    action: "approve_and_lock", before: { status: sheet.status }, after: { status: "locked" },
  });

  await notify(sheet.ownerId, {
    type: "goal_approved",
    title: "Your goals are approved",
    body: input.comment ?? "Sheet locked. Good luck this quarter.",
    link: `/goals/${sheet.id}`,
  });

  revalidateTag(`sheet:${sheet.id}`);
  revalidateTag(`user:${sheet.ownerId}`);
  revalidatePath(`/goals/${sheet.id}`);
  revalidatePath(`/dashboard`);
  revalidatePath(`/goals`);

  return { ok: true, data: { sheetId: sheet.id } };
}

export async function returnGoalSheet(input: z.infer<typeof ReturnSheetSchema>): Promise<Result<{ sheetId: string }>> {
  const parsed = ReturnSheetSchema.safeParse(input);
  if (!parsed.success) return fail("validation", parsed.error.issues.map((i) => i.message).join("; "));

  const session = await getSession();
  if (!session) return fail("unauthenticated", "Sign in to continue.");
  const db = getDb();
  const sheet = (await db.select().from(schema.goalSheet).where(eq(schema.goalSheet.id, input.sheetId)).limit(1))[0];
  if (!sheet) return fail("not_found", "Sheet not found.");
  try {
    await requirePermission(session, "goalSheet.return", { ownerId: sheet.ownerId, orgId: session.orgId });
  } catch {
    return fail("forbidden", "Only the assigned manager can return.");
  }
  const t = canTransition(sheet.status, "return", session.role);
  if (!t.ok) return fail("conflict", t.reason);

  await db
    .update(schema.goalSheet)
    .set({
      status: "draft",
      returnedAt: new Date(),
      returnComment: input.comment,
      updatedAt: new Date(),
    })
    .where(eq(schema.goalSheet.id, sheet.id));

  await db.insert(schema.approvalEvent).values({
    id: uuid(), sheetId: sheet.id, actorId: session.userId, action: "return", comment: input.comment,
  });
  await recordAudit({
    orgId: session.orgId, entityType: "goal_sheet", entityId: sheet.id, actorId: session.userId,
    action: "return_for_rework", before: { status: sheet.status }, after: { status: "draft" },
  });

  await notify(sheet.ownerId, {
    type: "goal_returned",
    title: "Your manager returned your goals for rework",
    body: input.comment,
    link: `/goals/${sheet.id}`,
  });

  revalidateTag(`sheet:${sheet.id}`);
  revalidateTag(`user:${sheet.ownerId}`);
  revalidatePath(`/goals/${sheet.id}`);
  revalidatePath(`/dashboard`);

  return { ok: true, data: { sheetId: sheet.id } };
}

export async function unlockGoalSheet(input: z.infer<typeof UnlockSheetSchema>): Promise<Result<{ sheetId: string }>> {
  const parsed = UnlockSheetSchema.safeParse(input);
  if (!parsed.success) return fail("validation", parsed.error.issues.map((i) => i.message).join("; "));
  const session = await getSession();
  if (!session) return fail("unauthenticated", "Sign in to continue.");
  const db = getDb();
  const sheet = (await db.select().from(schema.goalSheet).where(eq(schema.goalSheet.id, input.sheetId)).limit(1))[0];
  if (!sheet) return fail("not_found", "Sheet not found.");
  try {
    await requirePermission(session, "goalSheet.unlock", { ownerId: sheet.ownerId, orgId: session.orgId });
  } catch {
    return fail("forbidden", "Admins only.");
  }
  const t = canTransition(sheet.status, "unlock", session.role);
  if (!t.ok) return fail("conflict", t.reason);

  await db
    .update(schema.goalSheet)
    .set({ status: "reopened", reopenedAt: new Date(), lockedAt: null, updatedAt: new Date() })
    .where(eq(schema.goalSheet.id, sheet.id));
  await db.insert(schema.approvalEvent).values({
    id: uuid(), sheetId: sheet.id, actorId: session.userId, action: "unlock", comment: input.reason,
  });
  await recordAudit({
    orgId: session.orgId, entityType: "goal_sheet", entityId: sheet.id, actorId: session.userId,
    action: "unlock", before: { status: sheet.status }, after: { status: "reopened" },
  });
  await notify(sheet.ownerId, {
    type: "sheet_unlocked",
    title: "Admin unlocked your sheet",
    body: input.reason,
    link: `/goals/${sheet.id}`,
  });

  revalidateTag(`sheet:${sheet.id}`);
  revalidatePath(`/goals/${sheet.id}`);
  return { ok: true, data: { sheetId: sheet.id } };
}

export async function pushSharedGoal(input: z.infer<typeof PushSharedGoalSchema>): Promise<Result<{ count: number }>> {
  const parsed = PushSharedGoalSchema.safeParse(input);
  if (!parsed.success) return fail("validation", parsed.error.issues.map((i) => i.message).join("; "));

  const session = await getSession();
  if (!session) return fail("unauthenticated", "Sign in to continue.");
  try {
    await requirePermission(session, "sharedGoal.push", { orgId: session.orgId });
  } catch {
    return fail("forbidden", "Managers and admins only.");
  }

  const db = getDb();
  const primary = (await db.select().from(schema.goal).where(eq(schema.goal.id, input.primaryGoalId)).limit(1))[0];
  if (!primary) return fail("not_found", "Primary goal not found.");

  const linkId = uuid();
  await db.insert(schema.sharedGoalLink).values({
    id: linkId, primaryGoalId: primary.id, pushedById: session.userId, note: input.note ?? null,
  });

  // Get / create draft sheets for each recipient and append the goal as 'shared'.
  const cycle = (await db
    .select()
    .from(schema.goalCycle)
    .where(and(eq(schema.goalCycle.orgId, session.orgId), eq(schema.goalCycle.status, "open")))
    .limit(1))[0];
  if (!cycle) return fail("conflict", "No open cycle.");

  let count = 0;
  for (const userId of input.recipientUserIds) {
    const target = (await db.select().from(schema.user).where(eq(schema.user.id, userId)).limit(1))[0];
    if (!target) continue;
    const existingSheet = (await db
      .select()
      .from(schema.goalSheet)
      .where(and(eq(schema.goalSheet.cycleId, cycle.id), eq(schema.goalSheet.ownerId, userId)))
      .limit(1))[0];
    let sheetId = existingSheet?.id;
    if (!sheetId) {
      sheetId = uuid();
      await db.insert(schema.goalSheet).values({
        id: sheetId, cycleId: cycle.id, ownerId: userId, managerId: target.managerId,
        status: "draft", totalWeightageBp: 0,
      });
    }
    const newGoalId = uuid();
    await db.insert(schema.goal).values({
      id: newGoalId,
      sheetId,
      thrustAreaId: primary.thrustAreaId,
      title: primary.title,
      description: primary.description,
      uomType: primary.uomType,
      targetValue: primary.targetValue,
      targetDate: primary.targetDate,
      weightageBp: 1000,
      status: "not_started",
      source: "shared",
      sharedLinkId: linkId,
      position: 999,
    });
    await recordAudit({
      orgId: session.orgId, entityType: "shared_goal", entityId: linkId, actorId: session.userId,
      action: "push", after: { primaryGoalId: primary.id, recipientUserId: userId, goalId: newGoalId },
    });
    await notify(userId, {
      type: "shared_goal_pushed",
      title: `New shared goal: ${primary.title}`,
      body: input.note ?? "Adjust the weightage in your sheet — title and target are read-only.",
      link: `/goals/${sheetId}`,
    });
    count++;
  }
  revalidateTag(`org:${session.orgId}`);
  return { ok: true, data: { count } };
}

/**
 * Helper for shared-goal achievement propagation. Given the primary goal id,
 * mirror its current achievement state (`currentActual`, `actualCompletionDate`,
 * `status`, `computedScoreBp`) onto every linked recipient goal so dashboards
 * for shared participants always reflect the source-of-truth.
 *
 * No-op if the goal isn't a primary in any `sharedGoalLink`.
 */
export async function syncSharedAchievement(primaryGoalId: string): Promise<Result<{ propagatedTo: number }>> {
  const session = await getSession();
  if (!session) return fail("unauthenticated", "Sign in to continue.");
  const db = getDb();
  const primary = (await db.select().from(schema.goal).where(eq(schema.goal.id, primaryGoalId)).limit(1))[0];
  if (!primary) return fail("not_found", "Primary goal not found.");
  const link = (await db.select().from(schema.sharedGoalLink).where(eq(schema.sharedGoalLink.primaryGoalId, primary.id)).limit(1))[0];
  if (!link) return { ok: true, data: { propagatedTo: 0 } };

  const linked = await db.select().from(schema.goal).where(eq(schema.goal.sharedLinkId, link.id));
  let propagated = 0;
  for (const g of linked) {
    // Defensive: never sync onto the primary itself if it accidentally carries the link id.
    if (g.id === primary.id) continue;
    await db
      .update(schema.goal)
      .set({
        currentActual: primary.currentActual,
        actualCompletionDate: primary.actualCompletionDate,
        status: primary.status,
        computedScoreBp: primary.computedScoreBp,
        updatedAt: new Date(),
      })
      .where(eq(schema.goal.id, g.id));
    propagated++;
  }

  if (propagated > 0) {
    await recordAudit({
      orgId: session.orgId,
      entityType: "shared_goal",
      entityId: link.id,
      actorId: session.userId,
      action: "shared_sync",
      after: {
        primaryGoalId: primary.id,
        propagatedTo: propagated,
        currentActual: primary.currentActual,
        status: primary.status,
        actualCompletionDate: primary.actualCompletionDate,
        computedScoreBp: primary.computedScoreBp,
      },
    });
  }

  return { ok: true, data: { propagatedTo: propagated } };
}
