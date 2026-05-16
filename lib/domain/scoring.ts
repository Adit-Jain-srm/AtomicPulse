/**
 * BRD Table 0 — UoM scoring formulas.
 *
 * | UoM Type            | Formula                                   |
 * | Min (Numeric / %)   | Achievement / Target                      | (higher is better)
 * | Max (Numeric / %)   | Target / Achievement                      | (lower is better)
 * | Timeline            | (Deadline - Completion) bounded; 1 if early/on-time, 0 if late |
 * | Zero                | If actual === 0 → 1; else → 0             |
 *
 * All scores returned as basis points (0–10000) where 10000 = 100%.
 * Scores are tracking-only per BRD §2.2 (no rating).
 */

export type UomType = "min_num" | "min_pct" | "max_num" | "max_pct" | "timeline" | "zero";

export type ScoringInput = {
  uomType: UomType;
  target?: number | null;
  targetDate?: Date | string | null;
  actual?: number | null;
  completionDate?: Date | string | null;
};

export type ScoringResult = {
  /** 0..10000 basis points */
  bp: number;
  /** 0..1 ratio for display math */
  ratio: number;
  reason: string;
};

const toBp = (ratio: number): number => Math.max(0, Math.min(10000, Math.round(ratio * 10000)));

/** Same as toBp, but only bounded below at 0 — used when SCORE_CAP_AT_100 is disabled. */
const toBpUncapped = (ratio: number): number => Math.max(0, Math.round(ratio * 10000));

/**
 * Whether numeric/% scores are capped at 100% (BRD default behavior).
 * Set `SCORE_CAP_AT_100=false` to allow over-credit beyond target — useful for sales/incentive
 * dashboards where exceeding quota should be visible. Timeline and zero are unaffected.
 */
export function scoreCapEnabled(): boolean {
  return process.env.SCORE_CAP_AT_100 !== "false";
}

const dateOf = (d: Date | string | null | undefined) => {
  if (!d) return null;
  return typeof d === "string" ? new Date(d) : d;
};

export function computeScore(input: ScoringInput): ScoringResult {
  switch (input.uomType) {
    case "min_num":
    case "min_pct": {
      if (input.target == null || input.target === 0) {
        return { bp: 0, ratio: 0, reason: "Target not set" };
      }
      if (input.actual == null) return { bp: 0, ratio: 0, reason: "No actual recorded" };
      // Higher is better. Cap at 100% per typical performance scorecards (no over-credit beyond target)
      // unless SCORE_CAP_AT_100 is explicitly disabled.
      const ratio = Math.max(0, input.actual) / input.target;
      if (scoreCapEnabled()) {
        const capped = Math.min(1, ratio);
        return { bp: toBp(capped), ratio: capped, reason: `${input.actual} / ${input.target}` };
      }
      return { bp: toBpUncapped(ratio), ratio, reason: `${input.actual} / ${input.target}` };
    }
    case "max_num":
    case "max_pct": {
      if (input.target == null || input.target === 0) {
        return { bp: 0, ratio: 0, reason: "Target not set" };
      }
      if (input.actual == null) return { bp: 0, ratio: 0, reason: "No actual recorded" };
      // Lower is better.
      const safeActual = Math.max(input.actual, Number.EPSILON);
      const ratio = input.target / safeActual;
      if (scoreCapEnabled()) {
        const capped = Math.min(1, ratio);
        return { bp: toBp(capped), ratio: capped, reason: `${input.target} / ${input.actual}` };
      }
      return { bp: toBpUncapped(ratio), ratio, reason: `${input.target} / ${input.actual}` };
    }
    case "timeline": {
      const deadline = dateOf(input.targetDate);
      const completion = dateOf(input.completionDate);
      if (!deadline) return { bp: 0, ratio: 0, reason: "No deadline" };
      if (!completion) return { bp: 0, ratio: 0, reason: "Not yet completed" };
      // On or before deadline → 100%; otherwise 0% (BRD says "Completion date vs. Deadline").
      const onTime = completion.getTime() <= deadline.getTime();
      return onTime
        ? { bp: 10000, ratio: 1, reason: "Completed on or before deadline" }
        : { bp: 0, ratio: 0, reason: "Completed after deadline" };
    }
    case "zero": {
      if (input.actual == null) return { bp: 0, ratio: 0, reason: "No actual recorded" };
      // Zero is success.
      return input.actual === 0
        ? { bp: 10000, ratio: 1, reason: "Zero achieved" }
        : { bp: 0, ratio: 0, reason: "Non-zero result" };
    }
  }
}

/** Sheet-level weighted score in basis points. */
export function weightedSheetScore(
  goals: Array<{ weightageBp: number; computedScoreBp?: number | null }>
): number {
  let total = 0;
  let weightSum = 0;
  for (const g of goals) {
    if (g.computedScoreBp == null) continue;
    total += (g.computedScoreBp * g.weightageBp) / 10000;
    weightSum += g.weightageBp;
  }
  if (weightSum === 0) return 0;
  return Math.round((total * 10000) / weightSum);
}
