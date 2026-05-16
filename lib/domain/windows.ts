/**
 * Quarterly window logic per BRD §2.3.
 * Phase 1 — May (goal setting) ; Q1 — July ; Q2 — October ; Q3 — January ; Q4 — March/April.
 */
export type Period = "Q1" | "Q2" | "Q3" | "Q4";

export const ALL_PERIODS: Period[] = ["Q1", "Q2", "Q3", "Q4"];

export function periodLabel(p: Period) {
  return {
    Q1: "Q1 — July",
    Q2: "Q2 — October",
    Q3: "Q3 — January",
    Q4: "Q4 / Annual — Mar–Apr",
  }[p];
}

export function isWindowOpen(window: { opensAt: Date; closesAt: Date } | null | undefined, now: Date = new Date()): boolean {
  if (!window) return false;
  const o = window.opensAt instanceof Date ? window.opensAt : new Date(window.opensAt);
  const c = window.closesAt instanceof Date ? window.closesAt : new Date(window.closesAt);
  return now >= o && now <= c;
}

export function defaultPhaseOneWindow(fyStartYear: number) {
  return {
    opensAt: new Date(Date.UTC(fyStartYear, 4, 1)), // May 1
    locksAt: new Date(Date.UTC(fyStartYear, 5, 30, 23, 59, 59)), // June 30
  };
}

export function defaultCheckInWindows(fyStartYear: number): Record<Period, { opensAt: Date; closesAt: Date }> {
  return {
    Q1: { opensAt: new Date(Date.UTC(fyStartYear, 6, 1)), closesAt: new Date(Date.UTC(fyStartYear, 7, 31, 23, 59, 59)) },
    Q2: { opensAt: new Date(Date.UTC(fyStartYear, 9, 1)), closesAt: new Date(Date.UTC(fyStartYear, 10, 30, 23, 59, 59)) },
    Q3: { opensAt: new Date(Date.UTC(fyStartYear + 1, 0, 1)), closesAt: new Date(Date.UTC(fyStartYear + 1, 1, 28, 23, 59, 59)) },
    Q4: { opensAt: new Date(Date.UTC(fyStartYear + 1, 2, 1)), closesAt: new Date(Date.UTC(fyStartYear + 1, 3, 30, 23, 59, 59)) },
  };
}
