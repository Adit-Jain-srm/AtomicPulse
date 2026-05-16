import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { computeScore, weightedSheetScore } from "./scoring";

describe("computeScore — BRD Table 0", () => {
  describe("min (numeric/%) — higher is better", () => {
    it("on-target sales returns 100%", () => {
      const r = computeScore({ uomType: "min_num", target: 100, actual: 100 });
      expect(r.bp).toBe(10000);
    });
    it("under-target returns proportional", () => {
      const r = computeScore({ uomType: "min_num", target: 100, actual: 80 });
      expect(r.bp).toBe(8000);
    });
    it("over-target caps at 100%", () => {
      const r = computeScore({ uomType: "min_num", target: 100, actual: 130 });
      expect(r.bp).toBe(10000);
    });
    it("missing actual returns 0", () => {
      const r = computeScore({ uomType: "min_num", target: 100, actual: null });
      expect(r.bp).toBe(0);
    });
    it("missing target returns 0 with explanation", () => {
      const r = computeScore({ uomType: "min_num", target: null, actual: 50 });
      expect(r.bp).toBe(0);
      expect(r.reason).toMatch(/target/i);
    });
  });

  describe("max (numeric/%) — lower is better", () => {
    it("TAT met (actual = target) returns 100%", () => {
      const r = computeScore({ uomType: "max_num", target: 24, actual: 24 });
      expect(r.bp).toBe(10000);
    });
    it("TAT better than target returns 100% (capped)", () => {
      const r = computeScore({ uomType: "max_num", target: 24, actual: 12 });
      expect(r.bp).toBe(10000);
    });
    it("TAT worse than target returns proportional", () => {
      const r = computeScore({ uomType: "max_num", target: 24, actual: 48 });
      expect(r.bp).toBe(5000);
    });
  });

  describe("timeline — date completion vs deadline", () => {
    it("completed before deadline → 100%", () => {
      const r = computeScore({
        uomType: "timeline",
        targetDate: "2026-12-31",
        completionDate: "2026-11-15",
      });
      expect(r.bp).toBe(10000);
    });
    it("completed on deadline → 100%", () => {
      const r = computeScore({
        uomType: "timeline",
        targetDate: "2026-12-31",
        completionDate: "2026-12-31",
      });
      expect(r.bp).toBe(10000);
    });
    it("completed after deadline → 0%", () => {
      const r = computeScore({
        uomType: "timeline",
        targetDate: "2026-12-31",
        completionDate: "2027-01-15",
      });
      expect(r.bp).toBe(0);
    });
    it("not yet completed → 0%", () => {
      const r = computeScore({
        uomType: "timeline",
        targetDate: "2026-12-31",
        completionDate: null,
      });
      expect(r.bp).toBe(0);
    });
  });

  describe("zero — zero is success", () => {
    it("actual = 0 → 100%", () => {
      const r = computeScore({ uomType: "zero", actual: 0 });
      expect(r.bp).toBe(10000);
    });
    it("any non-zero → 0%", () => {
      const r = computeScore({ uomType: "zero", actual: 1 });
      expect(r.bp).toBe(0);
    });
    it("missing actual → 0%", () => {
      const r = computeScore({ uomType: "zero", actual: null });
      expect(r.bp).toBe(0);
    });
  });
});

describe("weightedSheetScore", () => {
  it("weights goals correctly", () => {
    const score = weightedSheetScore([
      { weightageBp: 4000, computedScoreBp: 8000 }, // 40% weight, 80% score
      { weightageBp: 3000, computedScoreBp: 10000 }, // 30% weight, 100% score
      { weightageBp: 3000, computedScoreBp: 5000 }, // 30% weight, 50% score
    ]);
    // (0.4*0.8 + 0.3*1.0 + 0.3*0.5) = 0.77 → 7700 bp
    expect(score).toBe(7700);
  });
  it("ignores goals with no recorded score", () => {
    const score = weightedSheetScore([
      { weightageBp: 5000, computedScoreBp: 10000 },
      { weightageBp: 5000, computedScoreBp: null },
    ]);
    // Only the scored half counts; weighted average over remaining weight = 100%
    expect(score).toBe(10000);
  });
  it("returns 0 when no goals scored", () => {
    const score = weightedSheetScore([
      { weightageBp: 5000, computedScoreBp: null },
      { weightageBp: 5000, computedScoreBp: null },
    ]);
    expect(score).toBe(0);
  });
});

describe("score cap flag", () => {
  const original = process.env.SCORE_CAP_AT_100;

  beforeEach(() => {
    delete process.env.SCORE_CAP_AT_100;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.SCORE_CAP_AT_100;
    else process.env.SCORE_CAP_AT_100 = original;
  });

  it("min_num overshoot caps at 100% when flag is default (cap on)", () => {
    const r = computeScore({ uomType: "min_num", target: 100, actual: 150 });
    expect(r.bp).toBe(10000);
  });

  it("min_num overshoot returns raw ratio when flag = 'false'", () => {
    process.env.SCORE_CAP_AT_100 = "false";
    const r = computeScore({ uomType: "min_num", target: 100, actual: 150 });
    expect(r.bp).toBe(15000);
  });

  it("max_num underrun caps at 100% when flag is default (cap on)", () => {
    // Lower is better; actual << target is over-achievement that should cap.
    const r = computeScore({ uomType: "max_num", target: 24, actual: 6 });
    expect(r.bp).toBe(10000);
  });

  it("max_num underrun returns raw ratio when flag = 'false'", () => {
    process.env.SCORE_CAP_AT_100 = "false";
    // 24 / 6 = 4.0 → 40000 bp uncapped
    const r = computeScore({ uomType: "max_num", target: 24, actual: 6 });
    expect(r.bp).toBe(40000);
  });
});
