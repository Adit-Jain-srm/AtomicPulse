import { describe, it, expect } from "vitest";
import { GoalSheetDraftSchema, GoalDraftSchema, CheckInSchema } from "@/lib/validation/goal-sheet";
import { computeScore } from "@/lib/domain/scoring";
import { canTransition } from "@/lib/domain/state-machine";
import { isWindowOpen } from "@/lib/domain/windows";

function draftGoal(overrides: Record<string, unknown> = {}) {
  return {
    thrustAreaId: "ta-1",
    title: "Ship product v2",
    description: "",
    uomType: "min_num" as const,
    targetValue: 100,
    targetDate: null,
    weightageBp: 5000,
    position: 0,
    ...overrides,
  };
}

describe("edge-cases: validation boundary conditions", () => {
  it("rejects weightage of exactly 9.99% (999bp)", () => {
    const r = GoalDraftSchema.safeParse(draftGoal({ weightageBp: 999 }));
    expect(r.success).toBe(false);
  });

  it("accepts weightage of exactly 10% (1000bp)", () => {
    const r = GoalDraftSchema.safeParse(draftGoal({ weightageBp: 1000 }));
    expect(r.success).toBe(true);
  });

  it("rejects weightage over 100% (10001bp)", () => {
    const r = GoalDraftSchema.safeParse(draftGoal({ weightageBp: 10001 }));
    expect(r.success).toBe(false);
  });

  it("rejects negative weightage", () => {
    const r = GoalDraftSchema.safeParse(draftGoal({ weightageBp: -1000 }));
    expect(r.success).toBe(false);
  });

  it("rejects non-integer weightage (fractional)", () => {
    const r = GoalDraftSchema.safeParse(draftGoal({ weightageBp: 5000.5 }));
    expect(r.success).toBe(false);
  });

  it("rejects title shorter than 3 characters", () => {
    const r = GoalDraftSchema.safeParse(draftGoal({ title: "AB" }));
    expect(r.success).toBe(false);
  });

  it("rejects title longer than 140 characters", () => {
    const r = GoalDraftSchema.safeParse(draftGoal({ title: "A".repeat(141) }));
    expect(r.success).toBe(false);
  });

  it("accepts exactly 140-char title", () => {
    const r = GoalDraftSchema.safeParse(draftGoal({ title: "A".repeat(140) }));
    expect(r.success).toBe(true);
  });

  it("rejects empty thrustAreaId", () => {
    const r = GoalDraftSchema.safeParse(draftGoal({ thrustAreaId: "" }));
    expect(r.success).toBe(false);
  });

  it("rejects description over 1200 chars", () => {
    const r = GoalDraftSchema.safeParse(draftGoal({ description: "X".repeat(1201) }));
    expect(r.success).toBe(false);
  });

  it("sum of exactly 10000bp across 8 goals (1250bp each) passes", () => {
    const goals = Array.from({ length: 8 }, (_, i) =>
      draftGoal({ weightageBp: 1250, position: i, title: `Goal ${i + 1}` })
    );
    const r = GoalSheetDraftSchema.safeParse({ sheetId: "s-1", goals });
    expect(r.success).toBe(true);
  });

  it("sum of 9999bp across goals rejects (1bp short)", () => {
    const goals = [
      draftGoal({ weightageBp: 5000, position: 0, title: "Goal A" }),
      draftGoal({ weightageBp: 4999, position: 1, title: "Goal B" }),
    ];
    const r = GoalSheetDraftSchema.safeParse({ sheetId: "s-1", goals });
    expect(r.success).toBe(false);
  });

  it("sum of 10001bp rejects (1bp over)", () => {
    const goals = [
      draftGoal({ weightageBp: 5001, position: 0, title: "Goal A" }),
      draftGoal({ weightageBp: 5000, position: 1, title: "Goal B" }),
    ];
    const r = GoalSheetDraftSchema.safeParse({ sheetId: "s-1", goals });
    expect(r.success).toBe(false);
  });
});

describe("edge-cases: scoring formulas boundary conditions", () => {
  it("min_num with target=0 returns 0 (avoid division by zero)", () => {
    const r = computeScore({ uomType: "min_num", target: 0, actual: 50 });
    expect(r.bp).toBe(0);
    expect(r.reason).toMatch(/target/i);
  });

  it("max_num with actual=0 uses epsilon (no infinity)", () => {
    const r = computeScore({ uomType: "max_num", target: 24, actual: 0 });
    expect(r.bp).toBe(10000); // capped at 100%
    expect(Number.isFinite(r.ratio)).toBe(true);
  });

  it("min_num with negative actual floors at 0bp", () => {
    const r = computeScore({ uomType: "min_num", target: 100, actual: -50 });
    expect(r.bp).toBe(0);
  });

  it("max_num with negative target returns 0 (invalid target)", () => {
    const r = computeScore({ uomType: "max_num", target: -10, actual: 5 });
    expect(r.bp).toBe(0);
  });

  it("timeline with same-second deadline passes", () => {
    const d = "2026-12-31T23:59:59.000Z";
    const r = computeScore({ uomType: "timeline", targetDate: d, completionDate: d });
    expect(r.bp).toBe(10000);
  });

  it("timeline 1ms after deadline fails", () => {
    const r = computeScore({
      uomType: "timeline",
      targetDate: "2026-12-31T23:59:59.000Z",
      completionDate: "2026-12-31T23:59:59.001Z",
    });
    expect(r.bp).toBe(0);
  });

  it("zero with actual=-0 (negative zero) still passes", () => {
    const r = computeScore({ uomType: "zero", actual: -0 });
    expect(r.bp).toBe(10000);
  });

  it("zero with very small float (0.0001) fails", () => {
    const r = computeScore({ uomType: "zero", actual: 0.0001 });
    expect(r.bp).toBe(0);
  });

  it("min_pct with 100% achievement returns 100%", () => {
    const r = computeScore({ uomType: "min_pct", target: 80, actual: 80 });
    expect(r.bp).toBe(10000);
  });

  it("max_pct with exactly-on-target returns 100%", () => {
    const r = computeScore({ uomType: "max_pct", target: 5, actual: 5 });
    expect(r.bp).toBe(10000);
  });
});

describe("edge-cases: state machine illegal transitions", () => {
  it("employee cannot approve their own sheet", () => {
    expect(canTransition("submitted", "approve", "employee").ok).toBe(false);
  });

  it("employee cannot return a sheet", () => {
    expect(canTransition("submitted", "return", "employee").ok).toBe(false);
  });

  it("manager cannot unlock a locked sheet (admin-only)", () => {
    expect(canTransition("locked", "unlock", "manager").ok).toBe(false);
  });

  it("cannot submit an already locked sheet", () => {
    expect(canTransition("locked", "submit", "employee").ok).toBe(false);
  });

  it("cannot approve a draft (must be submitted first)", () => {
    expect(canTransition("draft", "approve", "manager").ok).toBe(false);
  });

  it("double-submit is blocked", () => {
    expect(canTransition("submitted", "submit", "employee").ok).toBe(false);
  });

  it("admin CAN unlock an approved sheet", () => {
    expect(canTransition("approved", "unlock", "admin").ok).toBe(true);
  });
});

describe("edge-cases: check-in schema boundaries", () => {
  it("rejects missing goalId", () => {
    const r = CheckInSchema.safeParse({ goalId: "", period: "Q1", status: "on_track" });
    expect(r.success).toBe(false);
  });

  it("accepts null actualValue (employee may not have data yet)", () => {
    const r = CheckInSchema.safeParse({ goalId: "g-1", period: "Q1", status: "not_started", actualValue: null });
    expect(r.success).toBe(true);
  });

  it("rejects invalid status value", () => {
    const r = CheckInSchema.safeParse({ goalId: "g-1", period: "Q1", status: "in_progress" });
    expect(r.success).toBe(false);
  });

  it("accepts Q1 through Q4 periods only", () => {
    for (const p of ["Q1", "Q2", "Q3", "Q4"]) {
      expect(CheckInSchema.safeParse({ goalId: "g-1", period: p, status: "on_track" }).success).toBe(true);
    }
    expect(CheckInSchema.safeParse({ goalId: "g-1", period: "Q5", status: "on_track" }).success).toBe(false);
    expect(CheckInSchema.safeParse({ goalId: "g-1", period: "annual", status: "on_track" }).success).toBe(false);
  });
});

describe("edge-cases: window enforcement boundaries", () => {
  it("exact opensAt timestamp is inside window", () => {
    const w = { opensAt: new Date("2026-07-01T00:00:00Z"), closesAt: new Date("2026-08-31T23:59:59Z") };
    expect(isWindowOpen(w, new Date("2026-07-01T00:00:00Z"))).toBe(true);
  });

  it("exact closesAt timestamp is inside window", () => {
    const w = { opensAt: new Date("2026-07-01T00:00:00Z"), closesAt: new Date("2026-08-31T23:59:59Z") };
    expect(isWindowOpen(w, new Date("2026-08-31T23:59:59Z"))).toBe(true);
  });

  it("1ms before opensAt is outside window", () => {
    const w = { opensAt: new Date("2026-07-01T00:00:00Z"), closesAt: new Date("2026-08-31T23:59:59Z") };
    expect(isWindowOpen(w, new Date("2026-06-30T23:59:59.999Z"))).toBe(false);
  });

  it("1ms after closesAt is outside window", () => {
    const w = { opensAt: new Date("2026-07-01T00:00:00Z"), closesAt: new Date("2026-08-31T23:59:59Z") };
    expect(isWindowOpen(w, new Date("2026-09-01T00:00:00Z"))).toBe(false);
  });

  it("null window returns false", () => {
    expect(isWindowOpen(null)).toBe(false);
  });

  it("undefined window returns false", () => {
    expect(isWindowOpen(undefined)).toBe(false);
  });
});
