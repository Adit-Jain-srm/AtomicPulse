import "server-only";
import { and, eq, inArray, desc, asc, count, sql, gte, isNotNull } from "drizzle-orm";
import { getDb, schema } from "./client";
import type { Session } from "@/lib/auth/session";

export async function getActiveCycle(orgId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.goalCycle)
    .where(and(eq(schema.goalCycle.orgId, orgId), eq(schema.goalCycle.status, "open")))
    .limit(1);
  return rows[0] ?? null;
}

export async function getThrustAreas(orgId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.thrustArea)
    .where(and(eq(schema.thrustArea.orgId, orgId), eq(schema.thrustArea.isActive, true)))
    .orderBy(asc(schema.thrustArea.name));
}

export async function getCheckInWindows(cycleId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.checkInWindow)
    .where(eq(schema.checkInWindow.cycleId, cycleId))
    .orderBy(asc(schema.checkInWindow.opensAt));
}

export async function getOrCreateSheetForUser(opts: { cycleId: string; ownerId: string; managerId: string | null }) {
  const db = getDb();
  const existing = await db
    .select()
    .from(schema.goalSheet)
    .where(
      and(eq(schema.goalSheet.cycleId, opts.cycleId), eq(schema.goalSheet.ownerId, opts.ownerId))
    )
    .limit(1);
  if (existing[0]) return existing[0];
  const { v4: uuid } = await import("uuid");
  const id = uuid();
  await db.insert(schema.goalSheet).values({
    id,
    cycleId: opts.cycleId,
    ownerId: opts.ownerId,
    managerId: opts.managerId,
    status: "draft",
    totalWeightageBp: 0,
  });
  const created = await db.select().from(schema.goalSheet).where(eq(schema.goalSheet.id, id)).limit(1);
  return created[0]!;
}

export async function getSheetWithGoals(sheetId: string) {
  const db = getDb();
  const sheet = await db.select().from(schema.goalSheet).where(eq(schema.goalSheet.id, sheetId)).limit(1);
  if (!sheet[0]) return null;
  const goals = await db
    .select()
    .from(schema.goal)
    .where(eq(schema.goal.sheetId, sheetId))
    .orderBy(asc(schema.goal.position));
  return { sheet: sheet[0], goals };
}

export async function getDirectReports(managerId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.user)
    .where(eq(schema.user.managerId, managerId))
    .orderBy(asc(schema.user.displayName));
}

export async function getOrgUsers(orgId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.user)
    .where(eq(schema.user.orgId, orgId))
    .orderBy(asc(schema.user.displayName));
}

export async function getUserById(id: string) {
  const db = getDb();
  const rows = await db.select().from(schema.user).where(eq(schema.user.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getSheetsForCycle(cycleId: string) {
  const db = getDb();
  return db.select().from(schema.goalSheet).where(eq(schema.goalSheet.cycleId, cycleId));
}

export async function getSheetsForOwners(cycleId: string, ownerIds: string[]) {
  if (!ownerIds.length) return [];
  const db = getDb();
  return db
    .select()
    .from(schema.goalSheet)
    .where(and(eq(schema.goalSheet.cycleId, cycleId), inArray(schema.goalSheet.ownerId, ownerIds)));
}

export async function listGoalsForSheets(sheetIds: string[]) {
  if (!sheetIds.length) return [];
  const db = getDb();
  return db
    .select()
    .from(schema.goal)
    .where(inArray(schema.goal.sheetId, sheetIds))
    .orderBy(asc(schema.goal.position));
}

export async function getCheckInsForGoals(goalIds: string[]) {
  if (!goalIds.length) return [];
  const db = getDb();
  return db.select().from(schema.checkIn).where(inArray(schema.checkIn.goalId, goalIds));
}

export async function getRecentNotifications(userId: string, limit = 20) {
  const db = getDb();
  return db
    .select()
    .from(schema.notification)
    .where(eq(schema.notification.userId, userId))
    .orderBy(desc(schema.notification.createdAt))
    .limit(limit);
}

export async function getAuditTrail(orgId: string, limit = 200) {
  const db = getDb();
  return db
    .select()
    .from(schema.auditEvent)
    .where(eq(schema.auditEvent.orgId, orgId))
    .orderBy(desc(schema.auditEvent.occurredAt))
    .limit(limit);
}

export async function getEscalationRules(orgId: string) {
  const db = getDb();
  return db.select().from(schema.escalationRule).where(eq(schema.escalationRule.orgId, orgId));
}

export async function getEscalationEvents(orgId: string) {
  const db = getDb();
  // Events are not directly tied to org; we filter via the rule.
  const rules = await getEscalationRules(orgId);
  if (!rules.length) return [];
  return db
    .select()
    .from(schema.escalationEvent)
    .where(inArray(schema.escalationEvent.ruleId, rules.map((r) => r.id)))
    .orderBy(desc(schema.escalationEvent.raisedAt));
}

export async function loadDashboardData(session: Session) {
  const cycle = await getActiveCycle(session.orgId);
  if (!cycle) return { cycle: null };
  if (session.role === "employee") {
    const sheet = await getOrCreateSheetForUser({
      cycleId: cycle.id,
      ownerId: session.userId,
      managerId: session.managerId,
    });
    const goals = await listGoalsForSheets([sheet.id]);
    const checkIns = await getCheckInsForGoals(goals.map((g) => g.id));
    return { cycle, role: "employee" as const, sheet, goals, checkIns };
  }
  if (session.role === "manager") {
    const reports = await getDirectReports(session.userId);
    const sheets = await getSheetsForOwners(cycle.id, reports.map((r) => r.id));
    const goals = await listGoalsForSheets(sheets.map((s) => s.id));
    const checkIns = await getCheckInsForGoals(goals.map((g) => g.id));
    return { cycle, role: "manager" as const, reports, sheets, goals, checkIns };
  }
  // admin
  const users = await getOrgUsers(session.orgId);
  const sheets = await getSheetsForCycle(cycle.id);
  const goals = await listGoalsForSheets(sheets.map((s) => s.id));
  const checkIns = await getCheckInsForGoals(goals.map((g) => g.id));
  return { cycle, role: "admin" as const, users, sheets, goals, checkIns };
}
