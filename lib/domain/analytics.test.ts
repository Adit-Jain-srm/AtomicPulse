import { describe, it, expect } from "vitest";
import { computeScore, weightedSheetScore } from "@/lib/domain/scoring";
import type { Period } from "@/lib/domain/windows";
import { ALL_PERIODS } from "@/lib/domain/windows";

/**
 * Analytics aggregation logic tests.
 * Tests the pure computation used by analytics-view.tsx to derive QoQ trends,
 * heatmap values, goal distribution, and manager effectiveness percentages.
 */

function computeQoQScore(
  goals: Array<{ uomType: string; targetValue: number | null; weightageBp: number }>,
  checkIns: Array<{ goalId: string; period: string; actualValue: number | null }>,
  period: string,
  goalIds: string[]
): number {
  const periodCheckIns = checkIns.filter((c) => c.period === period);
  const scored = goalIds.map((gid, i) => {
    const g = goals[i];
    const c = periodCheckIns.find((ci) => ci.goalId === gid);
    const s = computeScore({
      uomType: g.uomType as any,
      target: g.targetValue,
      actual: c?.actualValue ?? null,
    });
    return { weight: g.weightageBp, score: s.bp };
  });
  const totalWeight = scored.reduce((s, x) => s + x.weight, 0);
  if (totalWeight === 0) return 0;
  return Math.round(scored.reduce((s, x) => s + (x.score * x.weight) / totalWeight, 0) / 100);
}

function computeManagerEffectiveness(
  totalReports: number,
  reportsWithCheckIn: number
): number {
  if (totalReports === 0) return 0;
  return Math.round((reportsWithCheckIn / totalReports) * 100);
}

function computeGoalDistribution(
  goals: Array<{ thrustAreaId: string; uomType: string; status: string }>
): { byThrust: Record<string, number>; byUom: Record<string, number>; byStatus: Record<string, number> } {
  const byThrust: Record<string, number> = {};
  const byUom: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const g of goals) {
    byThrust[g.thrustAreaId] = (byThrust[g.thrustAreaId] ?? 0) + 1;
    byUom[g.uomType] = (byUom[g.uomType] ?? 0) + 1;
    byStatus[g.status] = (byStatus[g.status] ?? 0) + 1;
  }
  return { byThrust, byUom, byStatus };
}

describe("analytics: QoQ composite score", () => {
  it("computes weighted average correctly for Q1", () => {
    const goals = [
      { uomType: "min_num", targetValue: 100, weightageBp: 6000 },
      { uomType: "min_num", targetValue: 50, weightageBp: 4000 },
    ];
    const checkIns = [
      { goalId: "g1", period: "Q1", actualValue: 80 },
      { goalId: "g2", period: "Q1", actualValue: 50 },
    ];
    const score = computeQoQScore(goals, checkIns, "Q1", ["g1", "g2"]);
    // g1: 80/100 = 80%, weight 60%. g2: 50/50 = 100%, weight 40%.
    // Weighted: (8000*6000 + 10000*4000) / 10000 / 100 = (48000000+40000000)/1000000 = 88
    expect(score).toBe(88);
  });

  it("returns 0 when no check-ins exist", () => {
    const goals = [{ uomType: "min_num", targetValue: 100, weightageBp: 10000 }];
    const score = computeQoQScore(goals, [], "Q1", ["g1"]);
    expect(score).toBe(0);
  });

  it("returns 0 when goals array is empty", () => {
    const score = computeQoQScore([], [], "Q1", []);
    expect(score).toBe(0);
  });

  it("handles mixed UoM types", () => {
    const goals = [
      { uomType: "min_num", targetValue: 100, weightageBp: 5000 },
      { uomType: "zero", targetValue: null, weightageBp: 5000 },
    ];
    const checkIns = [
      { goalId: "g1", period: "Q2", actualValue: 100 },
      { goalId: "g2", period: "Q2", actualValue: 0 },
    ];
    const score = computeQoQScore(goals, checkIns, "Q2", ["g1", "g2"]);
    // Both 100% → weighted = 100%
    expect(score).toBe(100);
  });
});

describe("analytics: manager effectiveness", () => {
  it("computes percentage correctly", () => {
    expect(computeManagerEffectiveness(5, 3)).toBe(60);
  });

  it("returns 100% when all reports have check-ins", () => {
    expect(computeManagerEffectiveness(4, 4)).toBe(100);
  });

  it("returns 0% when no reports have check-ins", () => {
    expect(computeManagerEffectiveness(4, 0)).toBe(0);
  });

  it("returns 0 when manager has 0 reports (no division by zero)", () => {
    expect(computeManagerEffectiveness(0, 0)).toBe(0);
  });

  it("rounds correctly", () => {
    expect(computeManagerEffectiveness(3, 1)).toBe(33);
    expect(computeManagerEffectiveness(3, 2)).toBe(67);
  });
});

describe("analytics: goal distribution", () => {
  it("counts by thrust area correctly", () => {
    const goals = [
      { thrustAreaId: "ta-1", uomType: "min_num", status: "on_track" },
      { thrustAreaId: "ta-1", uomType: "max_num", status: "completed" },
      { thrustAreaId: "ta-2", uomType: "zero", status: "not_started" },
    ];
    const dist = computeGoalDistribution(goals);
    expect(dist.byThrust["ta-1"]).toBe(2);
    expect(dist.byThrust["ta-2"]).toBe(1);
  });

  it("counts by UoM type correctly", () => {
    const goals = [
      { thrustAreaId: "ta-1", uomType: "min_num", status: "on_track" },
      { thrustAreaId: "ta-1", uomType: "min_num", status: "completed" },
      { thrustAreaId: "ta-2", uomType: "timeline", status: "not_started" },
    ];
    const dist = computeGoalDistribution(goals);
    expect(dist.byUom["min_num"]).toBe(2);
    expect(dist.byUom["timeline"]).toBe(1);
  });

  it("counts by status correctly", () => {
    const goals = [
      { thrustAreaId: "ta-1", uomType: "min_num", status: "on_track" },
      { thrustAreaId: "ta-1", uomType: "max_num", status: "on_track" },
      { thrustAreaId: "ta-2", uomType: "zero", status: "completed" },
    ];
    const dist = computeGoalDistribution(goals);
    expect(dist.byStatus["on_track"]).toBe(2);
    expect(dist.byStatus["completed"]).toBe(1);
  });

  it("handles empty goals array gracefully", () => {
    const dist = computeGoalDistribution([]);
    expect(Object.keys(dist.byThrust)).toHaveLength(0);
    expect(Object.keys(dist.byUom)).toHaveLength(0);
    expect(Object.keys(dist.byStatus)).toHaveLength(0);
  });

  it("all periods are defined", () => {
    expect(ALL_PERIODS).toEqual(["Q1", "Q2", "Q3", "Q4"]);
  });
});
