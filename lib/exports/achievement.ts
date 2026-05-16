import "server-only";
import * as XLSX from "xlsx";
import { eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { getActiveCycle } from "@/lib/db/queries";
import { computeScore, weightedSheetScore } from "@/lib/domain/scoring";
import type { Session } from "@/lib/auth/session";
import type { DbCheckIn, DbGoal } from "@/lib/db/schema";

export type Row = {
  Employee: string;
  Email: string;
  Manager: string;
  Department: string;
  ThrustArea: string;
  GoalTitle: string;
  UoM: string;
  Target: string;
  Weightage: string;
  Status: string;
  Q1_Actual: string;
  Q1_Status: string;
  Q1_Score: string;
  Q1_ManagerComment: string;
  Q2_Actual: string;
  Q2_Status: string;
  Q2_Score: string;
  Q2_ManagerComment: string;
  Q3_Actual: string;
  Q3_Status: string;
  Q3_Score: string;
  Q3_ManagerComment: string;
  Q4_Actual: string;
  Q4_Status: string;
  Q4_Score: string;
  Q4_ManagerComment: string;
  Composite_Score: string;
  SheetStatus: string;
};

type Quarter = "Q1" | "Q2" | "Q3" | "Q4";

const HEADER_ORDER: (keyof Row)[] = [
  "Employee",
  "Email",
  "Manager",
  "Department",
  "ThrustArea",
  "GoalTitle",
  "UoM",
  "Target",
  "Weightage",
  "Status",
  "Q1_Actual",
  "Q1_Status",
  "Q1_Score",
  "Q1_ManagerComment",
  "Q2_Actual",
  "Q2_Status",
  "Q2_Score",
  "Q2_ManagerComment",
  "Q3_Actual",
  "Q3_Status",
  "Q3_Score",
  "Q3_ManagerComment",
  "Q4_Actual",
  "Q4_Status",
  "Q4_Score",
  "Q4_ManagerComment",
  "Composite_Score",
  "SheetStatus",
];

function fmtNum(v: number | null | undefined) {
  return v == null ? "" : String(v);
}

function fmtPct(bp: number | null | undefined) {
  if (bp == null) return "";
  return `${(bp / 100).toFixed(0)}%`;
}

function quarterScoreBp(g: DbGoal, c: DbCheckIn | undefined): number | null {
  if (!c) return null;
  return computeScore({
    uomType: g.uomType,
    target: g.targetValue,
    targetDate: g.targetDate ?? null,
    actual: c.actualValue ?? null,
    completionDate: c.completionDate ?? null,
  }).bp;
}

/**
 * Best-available score for a goal: most-recent submitted check-in (Q4 → Q3 → Q2 → Q1).
 * "Submitted" = the employee marked it submitted (employeeSubmittedAt is set).
 * Returns null if no submitted check-in exists for any quarter.
 */
function bestAvailableScoreBp(g: DbGoal, goalCheckIns: DbCheckIn[]): number | null {
  for (const period of ["Q4", "Q3", "Q2", "Q1"] as const) {
    const c = goalCheckIns.find((x) => x.period === period && !!x.employeeSubmittedAt);
    if (c) return quarterScoreBp(g, c);
  }
  return null;
}

export async function buildAchievementRows(session: Session): Promise<Row[]> {
  const db = getDb();
  // Use the canonical active-cycle helper so exports always agree with the rest of the app.
  const cycle = await getActiveCycle(session.orgId);
  if (!cycle) return [];

  const sheets = await db.select().from(schema.goalSheet).where(eq(schema.goalSheet.cycleId, cycle.id));
  const sheetIds = sheets.map((s) => s.id);
  const goals = sheetIds.length ? await db.select().from(schema.goal).where(inArray(schema.goal.sheetId, sheetIds)) : [];
  const checkIns = goals.length ? await db.select().from(schema.checkIn).where(inArray(schema.checkIn.goalId, goals.map((g) => g.id))) : [];
  const users = await db.select().from(schema.user).where(eq(schema.user.orgId, session.orgId));
  const thrust = await db.select().from(schema.thrustArea).where(eq(schema.thrustArea.orgId, session.orgId));

  const userMap = new Map(users.map((u) => [u.id, u]));
  const thrustMap = new Map(thrust.map((t) => [t.id, t]));

  // RBAC scoping at row level
  let visibleSheetIds: Set<string>;
  if (session.role === "admin") {
    visibleSheetIds = new Set(sheets.map((s) => s.id));
  } else if (session.role === "manager") {
    const reports = users.filter((u) => u.managerId === session.userId).map((u) => u.id);
    visibleSheetIds = new Set(sheets.filter((s) => reports.includes(s.ownerId) || s.ownerId === session.userId).map((s) => s.id));
  } else {
    visibleSheetIds = new Set(sheets.filter((s) => s.ownerId === session.userId).map((s) => s.id));
  }

  // Precompute each sheet's composite using best-available scores so per-row
  // Composite_Score is consistent across goals of the same sheet.
  const sheetCompositeBp = new Map<string, number | null>();
  for (const s of sheets) {
    if (!visibleSheetIds.has(s.id)) continue;
    const sheetGoals = goals.filter((g) => g.sheetId === s.id);
    const goalScores: Array<{ weightageBp: number; computedScoreBp: number | null }> = [];
    let anyScored = false;
    for (const g of sheetGoals) {
      const best = bestAvailableScoreBp(g, checkIns.filter((c) => c.goalId === g.id));
      if (best != null) anyScored = true;
      goalScores.push({ weightageBp: g.weightageBp, computedScoreBp: best });
    }
    sheetCompositeBp.set(s.id, anyScored ? weightedSheetScore(goalScores) : null);
  }

  const rows: Row[] = [];
  for (const g of goals) {
    if (!visibleSheetIds.has(g.sheetId)) continue;
    const sheet = sheets.find((s) => s.id === g.sheetId);
    if (!sheet) continue;
    const owner = userMap.get(sheet.ownerId);
    const manager = sheet.managerId ? userMap.get(sheet.managerId) : null;
    const ta = thrustMap.get(g.thrustAreaId);
    const goalCheckIns = checkIns.filter((c) => c.goalId === g.id);

    const buildQuarter = (p: Quarter) => {
      const c = goalCheckIns.find((x) => x.period === p);
      if (!c) return { actual: "", status: "", score: "", comment: "" };
      const score = quarterScoreBp(g, c);
      return {
        actual: fmtNum(c.actualValue),
        status: c.status,
        score: fmtPct(score),
        comment: c.managerComment ?? "",
      };
    };
    const q1 = buildQuarter("Q1");
    const q2 = buildQuarter("Q2");
    const q3 = buildQuarter("Q3");
    const q4 = buildQuarter("Q4");

    const composite = sheetCompositeBp.get(g.sheetId) ?? null;

    rows.push({
      Employee: owner?.displayName ?? "",
      Email: owner?.email ?? "",
      Manager: manager?.displayName ?? "",
      Department: owner?.department ?? "",
      ThrustArea: ta?.name ?? "",
      GoalTitle: g.title,
      UoM: g.uomType,
      Target:
        g.uomType === "timeline"
          ? g.targetDate
            ? new Date(g.targetDate).toISOString().slice(0, 10)
            : ""
          : fmtNum(g.targetValue),
      Weightage: `${(g.weightageBp / 100).toFixed(0)}%`,
      Status: g.status,
      Q1_Actual: q1.actual,
      Q1_Status: q1.status,
      Q1_Score: q1.score,
      Q1_ManagerComment: q1.comment,
      Q2_Actual: q2.actual,
      Q2_Status: q2.status,
      Q2_Score: q2.score,
      Q2_ManagerComment: q2.comment,
      Q3_Actual: q3.actual,
      Q3_Status: q3.status,
      Q3_Score: q3.score,
      Q3_ManagerComment: q3.comment,
      Q4_Actual: q4.actual,
      Q4_Status: q4.status,
      Q4_Score: q4.score,
      Q4_ManagerComment: q4.comment,
      Composite_Score: fmtPct(composite),
      SheetStatus: sheet.status,
    });
  }
  return rows;
}

export function rowsToCsv(rows: Row[]): string {
  if (rows.length === 0) return `${HEADER_ORDER.join(",")}\n`;
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const out = [HEADER_ORDER.join(",")];
  for (const r of rows) out.push(HEADER_ORDER.map((h) => esc(r[h])).join(","));
  return out.join("\n");
}

export function rowsToXlsx(rows: Row[]): Uint8Array {
  const ws = XLSX.utils.json_to_sheet(rows, { header: HEADER_ORDER as string[] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Achievement");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new Uint8Array(buf);
}
