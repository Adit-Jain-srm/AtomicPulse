import { describe, it, expect } from "vitest";
import { GoalSheetDraftSchema, GoalDraftSchema, CheckInSchema, ManagerCheckInAckSchema, PushSharedGoalSchema } from "./goal-sheet";

function draftGoal(overrides: Partial<Parameters<typeof GoalDraftSchema.parse>[0]> = {}) {
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

describe("GoalSheetDraftSchema — BRD §2.1 validation", () => {
  it("accepts valid 2-goal sheet summing to 100%", () => {
    const result = GoalSheetDraftSchema.safeParse({
      sheetId: "sheet-1",
      goals: [
        draftGoal({ weightageBp: 6000, position: 0 }),
        draftGoal({ weightageBp: 4000, position: 1, title: "Goal two" }),
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects when total weightage ≠ 100%", () => {
    const result = GoalSheetDraftSchema.safeParse({
      sheetId: "sheet-1",
      goals: [
        draftGoal({ weightageBp: 5000 }),
        draftGoal({ weightageBp: 4000, title: "Goal two" }),
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes("100%"))).toBe(true);
    }
  });

  it("rejects individual goal weightage below 10% (1000bp)", () => {
    const result = GoalDraftSchema.safeParse(draftGoal({ weightageBp: 900 }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes("10%"))).toBe(true);
    }
  });

  it("rejects more than 8 goals", () => {
    const goals = Array.from({ length: 9 }, (_, i) =>
      draftGoal({ weightageBp: 1100, position: i, title: `Goal ${i + 1}` })
    );
    const result = GoalSheetDraftSchema.safeParse({ sheetId: "sheet-1", goals });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes("8"))).toBe(true);
    }
  });

  it("accepts exactly 8 goals summing to 100%", () => {
    const goals = Array.from({ length: 8 }, (_, i) =>
      draftGoal({ weightageBp: 1250, position: i, title: `Goal ${i + 1}` })
    );
    const result = GoalSheetDraftSchema.safeParse({ sheetId: "sheet-1", goals });
    expect(result.success).toBe(true);
  });

  it("rejects 0 goals (minimum 1)", () => {
    const result = GoalSheetDraftSchema.safeParse({ sheetId: "sheet-1", goals: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes("at least one"))).toBe(true);
    }
  });

  it("requires target value for numeric UoM types", () => {
    const result = GoalSheetDraftSchema.safeParse({
      sheetId: "sheet-1",
      goals: [draftGoal({ weightageBp: 10000, uomType: "min_num", targetValue: null })],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes("target value"))).toBe(true);
    }
  });

  it("requires target date for timeline UoM", () => {
    const result = GoalSheetDraftSchema.safeParse({
      sheetId: "sheet-1",
      goals: [draftGoal({ weightageBp: 10000, uomType: "timeline", targetValue: null, targetDate: null })],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes("target date"))).toBe(true);
    }
  });

  it("accepts timeline goal with valid date", () => {
    const result = GoalSheetDraftSchema.safeParse({
      sheetId: "sheet-1",
      goals: [draftGoal({ weightageBp: 10000, uomType: "timeline", targetValue: null, targetDate: "2026-12-31T00:00:00.000Z" })],
    });
    expect(result.success).toBe(true);
  });

  it("accepts zero UoM without target value", () => {
    const result = GoalSheetDraftSchema.safeParse({
      sheetId: "sheet-1",
      goals: [draftGoal({ weightageBp: 10000, uomType: "zero", targetValue: null })],
    });
    expect(result.success).toBe(true);
  });

  it("all six UoM types are valid", () => {
    const types = ["min_num", "min_pct", "max_num", "max_pct", "timeline", "zero"] as const;
    for (const t of types) {
      const overrides: Record<string, unknown> = { weightageBp: 10000, uomType: t };
      if (t === "timeline") {
        overrides.targetValue = null;
        overrides.targetDate = "2026-12-31T00:00:00.000Z";
      }
      if (t === "zero") {
        overrides.targetValue = null;
      }
      const result = GoalSheetDraftSchema.safeParse({
        sheetId: "sheet-1",
        goals: [draftGoal(overrides)],
      });
      expect(result.success, `UoM ${t} should pass`).toBe(true);
    }
  });
});

describe("CheckInSchema", () => {
  it("accepts valid check-in", () => {
    const r = CheckInSchema.safeParse({
      goalId: "g-1",
      period: "Q1",
      status: "on_track",
      actualValue: 85,
      completionDate: null,
      employeeNote: "Going well",
    });
    expect(r.success).toBe(true);
  });

  it("rejects invalid period", () => {
    const r = CheckInSchema.safeParse({
      goalId: "g-1",
      period: "Q5",
      status: "on_track",
      actualValue: 50,
    });
    expect(r.success).toBe(false);
  });

  it("accepts all valid statuses", () => {
    for (const s of ["not_started", "on_track", "completed"]) {
      const r = CheckInSchema.safeParse({
        goalId: "g-1",
        period: "Q2",
        status: s,
        actualValue: 50,
      });
      expect(r.success, `Status ${s} should pass`).toBe(true);
    }
  });
});

describe("ManagerCheckInAckSchema", () => {
  it("requires a non-empty comment", () => {
    const r = ManagerCheckInAckSchema.safeParse({ checkInId: "c-1", comment: "" });
    expect(r.success).toBe(false);
  });

  it("accepts valid ack", () => {
    const r = ManagerCheckInAckSchema.safeParse({
      checkInId: "c-1",
      comment: "Solid progress. Keep it up.",
    });
    expect(r.success).toBe(true);
  });
});

describe("PushSharedGoalSchema", () => {
  it("requires at least one recipient", () => {
    const r = PushSharedGoalSchema.safeParse({ primaryGoalId: "g-1", recipientUserIds: [] });
    expect(r.success).toBe(false);
  });

  it("accepts valid push", () => {
    const r = PushSharedGoalSchema.safeParse({
      primaryGoalId: "g-1",
      recipientUserIds: ["u-1", "u-2"],
      note: "Please align on this KPI",
    });
    expect(r.success).toBe(true);
  });
});
