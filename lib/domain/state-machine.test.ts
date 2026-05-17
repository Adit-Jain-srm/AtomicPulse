import { describe, it, expect } from "vitest";
import { canTransition, nextStatus, SHEET_STATUS_LABELS } from "./state-machine";
import { isWindowOpen, defaultCheckInWindows, defaultPhaseOneWindow, periodLabel, ALL_PERIODS } from "./windows";

describe("state-machine — BRD approval workflow", () => {
  describe("employee submit", () => {
    it("allows submit from draft", () => {
      expect(canTransition("draft", "submit", "employee").ok).toBe(true);
    });
    it("allows submit from reopened", () => {
      expect(canTransition("reopened", "submit", "employee").ok).toBe(true);
    });
    it("blocks submit from submitted", () => {
      expect(canTransition("submitted", "submit", "employee").ok).toBe(false);
    });
    it("blocks submit from locked", () => {
      expect(canTransition("locked", "submit", "employee").ok).toBe(false);
    });
  });

  describe("manager approve", () => {
    it("allows approve from submitted", () => {
      expect(canTransition("submitted", "approve", "manager").ok).toBe(true);
    });
    it("allows approve from in_review", () => {
      expect(canTransition("in_review", "approve", "manager").ok).toBe(true);
    });
    it("blocks employee from approving", () => {
      expect(canTransition("submitted", "approve", "employee").ok).toBe(false);
    });
    it("blocks approve from draft", () => {
      expect(canTransition("draft", "approve", "manager").ok).toBe(false);
    });
  });

  describe("manager return for rework", () => {
    it("allows return from submitted", () => {
      expect(canTransition("submitted", "return", "manager").ok).toBe(true);
    });
    it("allows return from in_review", () => {
      expect(canTransition("in_review", "return", "manager").ok).toBe(true);
    });
    it("blocks return from locked", () => {
      expect(canTransition("locked", "return", "manager").ok).toBe(false);
    });
    it("blocks employee from returning", () => {
      expect(canTransition("submitted", "return", "employee").ok).toBe(false);
    });
  });

  describe("admin unlock", () => {
    it("allows unlock from locked", () => {
      expect(canTransition("locked", "unlock", "admin").ok).toBe(true);
    });
    it("allows unlock from approved", () => {
      expect(canTransition("approved", "unlock", "admin").ok).toBe(true);
    });
    it("blocks non-admin from unlock", () => {
      expect(canTransition("locked", "unlock", "manager").ok).toBe(false);
    });
  });

  describe("nextStatus transitions", () => {
    it("submit → submitted", () => expect(nextStatus("draft", "submit")).toBe("submitted"));
    it("approve → locked", () => expect(nextStatus("submitted", "approve")).toBe("locked"));
    it("return → draft", () => expect(nextStatus("submitted", "return")).toBe("draft"));
    it("unlock → reopened", () => expect(nextStatus("locked", "unlock")).toBe("reopened"));
  });

  describe("status labels", () => {
    it("has labels for all statuses", () => {
      expect(SHEET_STATUS_LABELS["draft"]).toBe("Draft");
      expect(SHEET_STATUS_LABELS["submitted"]).toBe("Awaiting review");
      expect(SHEET_STATUS_LABELS["locked"]).toBe("Locked");
      expect(SHEET_STATUS_LABELS["reopened"]).toBe("Reopened");
    });
  });
});

describe("windows — BRD §2.3 quarterly schedule", () => {
  const fy = 2026; // FY26 starting May 2026

  it("phase one window opens May 1", () => {
    const w = defaultPhaseOneWindow(fy);
    expect(w.opensAt.getUTCMonth()).toBe(4); // May = month 4
    expect(w.opensAt.getUTCDate()).toBe(1);
  });

  it("Q1 window opens July", () => {
    const windows = defaultCheckInWindows(fy);
    expect(windows.Q1.opensAt.getUTCMonth()).toBe(6); // July = month 6
  });

  it("Q2 window opens October", () => {
    const windows = defaultCheckInWindows(fy);
    expect(windows.Q2.opensAt.getUTCMonth()).toBe(9); // October = month 9
  });

  it("Q3 window opens January (next year)", () => {
    const windows = defaultCheckInWindows(fy);
    expect(windows.Q3.opensAt.getUTCMonth()).toBe(0); // January
    expect(windows.Q3.opensAt.getUTCFullYear()).toBe(fy + 1);
  });

  it("Q4 window opens March (next year)", () => {
    const windows = defaultCheckInWindows(fy);
    expect(windows.Q4.opensAt.getUTCMonth()).toBe(2); // March
    expect(windows.Q4.opensAt.getUTCFullYear()).toBe(fy + 1);
  });

  it("isWindowOpen returns true inside window", () => {
    const windows = defaultCheckInWindows(fy);
    const midJuly = new Date(Date.UTC(fy, 6, 15));
    expect(isWindowOpen(windows.Q1, midJuly)).toBe(true);
  });

  it("isWindowOpen returns false before window opens", () => {
    const windows = defaultCheckInWindows(fy);
    const june = new Date(Date.UTC(fy, 5, 15));
    expect(isWindowOpen(windows.Q1, june)).toBe(false);
  });

  it("isWindowOpen returns false after window closes", () => {
    const windows = defaultCheckInWindows(fy);
    const sept = new Date(Date.UTC(fy, 8, 1));
    expect(isWindowOpen(windows.Q1, sept)).toBe(false);
  });

  it("all periods have labels", () => {
    for (const p of ALL_PERIODS) {
      expect(periodLabel(p)).toBeTruthy();
    }
  });

  it("period labels match BRD schedule", () => {
    expect(periodLabel("Q1")).toContain("July");
    expect(periodLabel("Q2")).toContain("October");
    expect(periodLabel("Q3")).toContain("January");
    expect(periodLabel("Q4")).toMatch(/Mar|Apr/);
  });
});
