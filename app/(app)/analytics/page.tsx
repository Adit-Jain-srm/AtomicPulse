import { requireSession } from "@/lib/auth/session";
import { loadDashboardData, getThrustAreas, getCheckInWindows } from "@/lib/db/queries";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import type { DbCheckInWindow, DbGoalSheet, DbUser } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export type ManagerEffectivenessRow = {
  managerId: string;
  managerName: string;
  totalReports: number;
  withCurrentCheckIn: number;
  pct: number;
};

/**
 * Pick the most relevant check-in window for "current" effectiveness:
 * an open window if any, otherwise the most recently closed window.
 */
function pickRecentWindow(windows: DbCheckInWindow[]): DbCheckInWindow | null {
  const now = Date.now();
  const open = windows.filter((w) => now >= w.opensAt.getTime() && now <= w.closesAt.getTime());
  if (open.length) {
    return [...open].sort((a, b) => b.opensAt.getTime() - a.opensAt.getTime())[0];
  }
  const closed = windows.filter((w) => now > w.closesAt.getTime());
  if (closed.length) {
    return [...closed].sort((a, b) => b.closesAt.getTime() - a.closesAt.getTime())[0];
  }
  return null;
}

export default async function AnalyticsPage() {
  const session = await requireSession();
  const data = await loadDashboardData(session);
  const thrustAreas = await getThrustAreas(session.orgId);

  if (!data.cycle) return <div className="p-10 text-center">No active cycle.</div>;

  let sheets: DbGoalSheet[] = [];
  let users: DbUser[] = [];
  if (data.role === "employee") {
    sheets = [data.sheet];
  } else {
    sheets = data.sheets;
    users = data.role === "manager" ? data.reports : data.users;
  }

  // Manager effectiveness: % of each manager's direct reports who submitted a
  // check-in for the most recent window. Admins see org-wide; managers see only
  // their own row; employees see nothing.
  const windows = await getCheckInWindows(data.cycle.id);
  const recentWindow = pickRecentWindow(windows);

  const managerEffectiveness: ManagerEffectivenessRow[] = [];
  if (recentWindow && data.role !== "employee") {
    type Mgr = { id: string; displayName: string };
    const managers: Mgr[] = [];
    let usersForReportLookup: DbUser[] = [];

    if (data.role === "admin") {
      const managerIds = new Set(
        data.users.map((u) => u.managerId).filter((x): x is string => !!x)
      );
      for (const id of managerIds) {
        const u = data.users.find((x) => x.id === id);
        if (u) managers.push({ id: u.id, displayName: u.displayName });
      }
      usersForReportLookup = data.users;
    } else if (data.role === "manager") {
      managers.push({ id: session.userId, displayName: session.displayName });
      usersForReportLookup = data.reports;
    }

    for (const m of managers) {
      const reports = usersForReportLookup.filter((u) => u.managerId === m.id);
      if (!reports.length) continue;
      const reportSheetIds = new Set(
        sheets.filter((s) => reports.some((r) => r.id === s.ownerId)).map((s) => s.id)
      );
      const ownersWithSubmittedCheckIn = new Set<string>();
      for (const ci of data.checkIns) {
        if (ci.period !== recentWindow.period) continue;
        if (!ci.employeeSubmittedAt) continue;
        const goal = data.goals.find((g) => g.id === ci.goalId);
        if (!goal) continue;
        if (!reportSheetIds.has(goal.sheetId)) continue;
        const sheet = sheets.find((s) => s.id === goal.sheetId);
        if (sheet) ownersWithSubmittedCheckIn.add(sheet.ownerId);
      }
      managerEffectiveness.push({
        managerId: m.id,
        managerName: m.displayName,
        totalReports: reports.length,
        withCurrentCheckIn: ownersWithSubmittedCheckIn.size,
        pct: Math.round((ownersWithSubmittedCheckIn.size / reports.length) * 100),
      });
    }
  }

  return (
    <AnalyticsView
      session={session}
      cycle={data.cycle}
      goals={data.goals}
      sheets={sheets}
      checkIns={data.checkIns}
      users={users}
      thrustAreas={thrustAreas}
      managerEffectiveness={managerEffectiveness}
    />
  );
}
