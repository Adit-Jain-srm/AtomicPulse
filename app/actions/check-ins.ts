"use server";
import { v4 as uuid } from "uuid";
import { revalidatePath, revalidateTag } from "next/cache";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/rbac/guards";
import { CheckInSchema, ManagerCheckInAckSchema } from "@/lib/validation/goal-sheet";
import { computeScore } from "@/lib/domain/scoring";
import { recordAudit } from "@/lib/domain/audit";
import { syncSharedAchievement } from "./goals";

type Result<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

function fail(code: string, message: string): Result<never> {
  return { ok: false, error: { code, message } };
}

export async function upsertCheckIn(input: z.infer<typeof CheckInSchema> & { markSubmitted?: boolean }): Promise<Result<{ checkInId: string; computedScoreBp: number }>> {
  const parsed = CheckInSchema.safeParse(input);
  if (!parsed.success) return fail("validation", parsed.error.issues.map((i) => i.message).join("; "));
  const session = await getSession();
  if (!session) return fail("unauthenticated", "Sign in.");

  const db = getDb();
  const goal = (await db.select().from(schema.goal).where(eq(schema.goal.id, input.goalId)).limit(1))[0];
  if (!goal) return fail("not_found", "Goal not found.");
  const sheet = (await db.select().from(schema.goalSheet).where(eq(schema.goalSheet.id, goal.sheetId)).limit(1))[0];
  if (!sheet) return fail("not_found", "Sheet not found.");

  try {
    await requirePermission(session, "checkIn.submit", { ownerId: sheet.ownerId, orgId: session.orgId });
  } catch {
    return fail("forbidden", "You can only check in on your own goals.");
  }

  if (sheet.status !== "locked" && sheet.status !== "approved") {
    return fail("conflict", `Sheet must be approved/locked before check-ins. Current: ${sheet.status}.`);
  }

  // Window enforcement
  const window = (await db.select().from(schema.checkInWindow).where(and(eq(schema.checkInWindow.cycleId, sheet.cycleId), eq(schema.checkInWindow.period, input.period))).limit(1))[0];
  if (!window) return fail("conflict", "Quarterly window is not configured.");
  const now = Date.now();
  if (now < window.opensAt.getTime() || now > window.closesAt.getTime()) {
    return fail("window_closed", `${input.period} check-in window is closed.`);
  }

  const score = computeScore({
    uomType: goal.uomType,
    target: goal.targetValue,
    targetDate: goal.targetDate ?? null,
    actual: input.actualValue ?? null,
    completionDate: input.completionDate ? new Date(input.completionDate) : null,
  });

  const existing = (await db.select().from(schema.checkIn).where(and(eq(schema.checkIn.goalId, goal.id), eq(schema.checkIn.period, input.period))).limit(1))[0];

  let checkInId: string;
  if (existing) {
    checkInId = existing.id;
    await db.update(schema.checkIn).set({
      status: input.status,
      actualValue: input.actualValue ?? null,
      completionDate: input.completionDate ? new Date(input.completionDate) : null,
      employeeNote: input.employeeNote ?? null,
      employeeSubmittedAt: input.markSubmitted ? new Date() : existing.employeeSubmittedAt,
      computedScoreBp: score.bp,
      managerId: sheet.managerId,
      updatedAt: new Date(),
    }).where(eq(schema.checkIn.id, existing.id));
  } else {
    checkInId = uuid();
    await db.insert(schema.checkIn).values({
      id: checkInId,
      goalId: goal.id,
      period: input.period,
      status: input.status,
      actualValue: input.actualValue ?? null,
      completionDate: input.completionDate ? new Date(input.completionDate) : null,
      employeeNote: input.employeeNote ?? null,
      employeeSubmittedAt: input.markSubmitted ? new Date() : null,
      managerId: sheet.managerId,
      computedScoreBp: score.bp,
    });
  }

  // Update goal current actual + status
  await db.update(schema.goal).set({
    currentActual: input.actualValue ?? goal.currentActual ?? null,
    status: input.status,
    computedScoreBp: score.bp,
    actualCompletionDate: input.completionDate ? new Date(input.completionDate) : goal.actualCompletionDate ?? null,
    updatedAt: new Date(),
  }).where(eq(schema.goal.id, goal.id));

  await recordAudit({
    orgId: session.orgId, entityType: "check_in", entityId: checkInId, actorId: session.userId,
    action: input.markSubmitted ? "checkin_submit" : "checkin_save",
    after: { goalId: goal.id, period: input.period, status: input.status, actualValue: input.actualValue, scoreBp: score.bp },
  });

  if (input.markSubmitted && sheet.managerId) {
    await db.insert(schema.notification).values({
      id: uuid(), userId: sheet.managerId, channel: "in_app", type: "checkin_submitted",
      title: `${session.displayName} submitted ${input.period} check-in`,
      body: `${goal.title} · ${input.status.replace("_", " ")} · ${(score.bp / 100).toFixed(0)}% score`,
      link: `/check-ins/${sheet.ownerId}`,
    });
  }

  // On submit, fan the latest primary actuals out to any shared linked goals
  // so recipients see live progress without their own check-in.
  if (input.markSubmitted) {
    await syncSharedAchievement(input.goalId);
  }

  revalidateTag(`sheet:${sheet.id}`);
  revalidateTag(`user:${sheet.ownerId}`);
  revalidatePath(`/check-ins`);
  revalidatePath(`/dashboard`);
  return { ok: true, data: { checkInId, computedScoreBp: score.bp } };
}

export async function acknowledgeCheckIn(input: z.infer<typeof ManagerCheckInAckSchema>): Promise<Result<{ checkInId: string }>> {
  const parsed = ManagerCheckInAckSchema.safeParse(input);
  if (!parsed.success) return fail("validation", parsed.error.issues.map((i) => i.message).join("; "));
  const session = await getSession();
  if (!session) return fail("unauthenticated", "Sign in.");

  const db = getDb();
  const checkIn = (await db.select().from(schema.checkIn).where(eq(schema.checkIn.id, input.checkInId)).limit(1))[0];
  if (!checkIn) return fail("not_found", "Check-in not found.");
  const goal = (await db.select().from(schema.goal).where(eq(schema.goal.id, checkIn.goalId)).limit(1))[0];
  if (!goal) return fail("not_found", "Goal not found.");
  const sheet = (await db.select().from(schema.goalSheet).where(eq(schema.goalSheet.id, goal.sheetId)).limit(1))[0];
  if (!sheet) return fail("not_found", "Sheet not found.");

  try {
    await requirePermission(session, "checkIn.manager.acknowledge", { ownerId: sheet.ownerId, orgId: session.orgId });
  } catch {
    return fail("forbidden", "Only the assigned manager can acknowledge.");
  }

  await db.update(schema.checkIn).set({
    managerComment: input.comment,
    managerAcknowledgedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(schema.checkIn.id, checkIn.id));

  await recordAudit({
    orgId: session.orgId, entityType: "check_in", entityId: checkIn.id, actorId: session.userId,
    action: "checkin_ack",
    after: { comment: input.comment },
  });

  await db.insert(schema.notification).values({
    id: uuid(),
    userId: sheet.ownerId, channel: "in_app", type: "checkin_acked",
    title: `Manager acknowledged your ${checkIn.period} check-in`,
    body: input.comment,
    link: `/check-ins`,
  });

  revalidateTag(`sheet:${sheet.id}`);
  revalidatePath(`/check-ins`);
  revalidatePath(`/check-ins/${sheet.ownerId}`);
  revalidatePath(`/dashboard`);
  return { ok: true, data: { checkInId: checkIn.id } };
}
