import { describe, it, expect } from "vitest";

/**
 * Escalation sweep logic tests.
 * Since runEscalationSweep requires DB access, we test the trigger logic
 * and deduplication patterns as pure functions.
 */

const DAY = 24 * 60 * 60 * 1000;

// Simulate trigger conditions
function shouldTriggerNoSubmit(sheetStatus: string, cycleOpensAt: number, now: number, thresholdDays: number): boolean {
  if (sheetStatus !== "draft" && sheetStatus !== "reopened") return false;
  return now - cycleOpensAt >= thresholdDays * DAY;
}

function shouldTriggerNoApprove(sheetStatus: string, submittedAt: number | null, managerId: string | null, now: number, thresholdDays: number): boolean {
  if (sheetStatus !== "submitted" && sheetStatus !== "in_review") return false;
  if (!submittedAt || !managerId) return false;
  return now - submittedAt >= thresholdDays * DAY;
}

function shouldTriggerNoCheckin(
  windowOpensAt: number, windowClosesAt: number, thresholdDays: number,
  now: number, hasSubmittedCheckIn: boolean, sheetStatus: string
): boolean {
  if (sheetStatus !== "approved" && sheetStatus !== "locked") return false;
  if (now < windowOpensAt + thresholdDays * DAY) return false;
  if (now > windowClosesAt) return false;
  return !hasSubmittedCheckIn;
}

function isDuplicate(seen: Set<string>, ruleId: string, targetUserId: string, entityRef: string): boolean {
  const key = `${ruleId}|${targetUserId}|${entityRef}`;
  if (seen.has(key)) return true;
  seen.add(key);
  return false;
}

function resolveChainTarget(chain: { to: string; afterDays: number }[], daysSinceRaised: number): string | null {
  let target: string | null = null;
  for (const step of chain) {
    if (daysSinceRaised >= step.afterDays) target = step.to;
  }
  return target;
}

describe("escalation triggers", () => {
  const now = Date.now();

  describe("no_submit", () => {
    it("fires when sheet is draft beyond threshold", () => {
      const opened = now - 8 * DAY;
      expect(shouldTriggerNoSubmit("draft", opened, now, 7)).toBe(true);
    });
    it("fires for reopened sheets too", () => {
      const opened = now - 10 * DAY;
      expect(shouldTriggerNoSubmit("reopened", opened, now, 7)).toBe(true);
    });
    it("does not fire before threshold", () => {
      const opened = now - 5 * DAY;
      expect(shouldTriggerNoSubmit("draft", opened, now, 7)).toBe(false);
    });
    it("does not fire for submitted sheets", () => {
      const opened = now - 20 * DAY;
      expect(shouldTriggerNoSubmit("submitted", opened, now, 7)).toBe(false);
    });
    it("does not fire for locked sheets", () => {
      const opened = now - 20 * DAY;
      expect(shouldTriggerNoSubmit("locked", opened, now, 7)).toBe(false);
    });
    it("0-threshold fires immediately", () => {
      expect(shouldTriggerNoSubmit("draft", now, now, 0)).toBe(true);
    });
  });

  describe("no_approve", () => {
    it("fires when submitted beyond threshold", () => {
      const submitted = now - 6 * DAY;
      expect(shouldTriggerNoApprove("submitted", submitted, "mgr-1", now, 5)).toBe(true);
    });
    it("fires for in_review status", () => {
      const submitted = now - 6 * DAY;
      expect(shouldTriggerNoApprove("in_review", submitted, "mgr-1", now, 5)).toBe(true);
    });
    it("does not fire before threshold", () => {
      const submitted = now - 3 * DAY;
      expect(shouldTriggerNoApprove("submitted", submitted, "mgr-1", now, 5)).toBe(false);
    });
    it("skips when managerId is null", () => {
      const submitted = now - 20 * DAY;
      expect(shouldTriggerNoApprove("submitted", submitted, null, now, 5)).toBe(false);
    });
    it("skips when submittedAt is null", () => {
      expect(shouldTriggerNoApprove("submitted", null, "mgr-1", now, 5)).toBe(false);
    });
  });

  describe("no_checkin", () => {
    it("fires when window open + no check-in + beyond threshold", () => {
      const opens = now - 12 * DAY;
      const closes = now + 20 * DAY;
      expect(shouldTriggerNoCheckin(opens, closes, 10, now, false, "locked")).toBe(true);
    });
    it("does not fire if check-in already submitted", () => {
      const opens = now - 12 * DAY;
      const closes = now + 20 * DAY;
      expect(shouldTriggerNoCheckin(opens, closes, 10, now, true, "locked")).toBe(false);
    });
    it("does not fire before threshold elapses", () => {
      const opens = now - 5 * DAY;
      const closes = now + 25 * DAY;
      expect(shouldTriggerNoCheckin(opens, closes, 10, now, false, "locked")).toBe(false);
    });
    it("does not fire after window closes", () => {
      const opens = now - 60 * DAY;
      const closes = now - 1 * DAY;
      expect(shouldTriggerNoCheckin(opens, closes, 10, now, false, "locked")).toBe(false);
    });
    it("does not fire for draft sheets (must be approved/locked)", () => {
      const opens = now - 12 * DAY;
      const closes = now + 20 * DAY;
      expect(shouldTriggerNoCheckin(opens, closes, 10, now, false, "draft")).toBe(false);
    });
  });
});

describe("deduplication", () => {
  it("first occurrence is not duplicate", () => {
    const seen = new Set<string>();
    expect(isDuplicate(seen, "rule-1", "user-1", "sheet:abc")).toBe(false);
  });
  it("second occurrence of same key is duplicate", () => {
    const seen = new Set<string>();
    isDuplicate(seen, "rule-1", "user-1", "sheet:abc");
    expect(isDuplicate(seen, "rule-1", "user-1", "sheet:abc")).toBe(true);
  });
  it("different rule same target is not duplicate", () => {
    const seen = new Set<string>();
    isDuplicate(seen, "rule-1", "user-1", "sheet:abc");
    expect(isDuplicate(seen, "rule-2", "user-1", "sheet:abc")).toBe(false);
  });
  it("same rule different target is not duplicate", () => {
    const seen = new Set<string>();
    isDuplicate(seen, "rule-1", "user-1", "sheet:abc");
    expect(isDuplicate(seen, "rule-1", "user-2", "sheet:abc")).toBe(false);
  });
});

describe("chain progression", () => {
  const chain = [
    { to: "owner", afterDays: 0 },
    { to: "manager", afterDays: 3 },
    { to: "skip_level", afterDays: 6 },
    { to: "hr", afterDays: 9 },
  ];

  it("day 0 targets owner", () => {
    expect(resolveChainTarget(chain, 0)).toBe("owner");
  });
  it("day 2 still targets owner", () => {
    expect(resolveChainTarget(chain, 2)).toBe("owner");
  });
  it("day 3 escalates to manager", () => {
    expect(resolveChainTarget(chain, 3)).toBe("manager");
  });
  it("day 6 escalates to skip_level", () => {
    expect(resolveChainTarget(chain, 6)).toBe("skip_level");
  });
  it("day 9+ escalates to hr", () => {
    expect(resolveChainTarget(chain, 9)).toBe("hr");
    expect(resolveChainTarget(chain, 15)).toBe("hr");
  });
  it("empty chain returns null", () => {
    expect(resolveChainTarget([], 5)).toBe(null);
  });
});
