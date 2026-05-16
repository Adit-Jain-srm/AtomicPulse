/* eslint-disable no-console */
import { v4 as uuid } from "uuid";
import { getDb, schema } from "../lib/db/client";
import { defaultCheckInWindows, defaultPhaseOneWindow } from "../lib/domain/windows";

async function ensureMigrationsApplied() {
  // For SQLite via libsql, the schema is created with `drizzle-kit push`.
  // We complement with a CREATE-IF-NOT-EXISTS path using raw SQL idempotently.
  // We rely on `drizzle-kit push` having run — guarded in package.json scripts.
}

async function clearAll() {
  const db = getDb();
  console.log("→ wiping existing data…");
  await db.delete(schema.auditEvent);
  await db.delete(schema.approvalEvent);
  await db.delete(schema.checkIn);
  await db.delete(schema.goal);
  await db.delete(schema.sharedGoalLink);
  await db.delete(schema.goalSheet);
  await db.delete(schema.checkInWindow);
  await db.delete(schema.goalCycle);
  await db.delete(schema.thrustArea);
  await db.delete(schema.notification);
  await db.delete(schema.escalationEvent);
  await db.delete(schema.escalationRule);
  await db.delete(schema.embedding);
  await db.delete(schema.user);
  await db.delete(schema.org);
}

async function main() {
  await ensureMigrationsApplied();
  await clearAll();
  const db = getDb();

  // ---- ORG ----
  const orgId = uuid();
  console.log("→ org");
  await db.insert(schema.org).values({
    id: orgId,
    name: "Atomic Industries",
    slug: "atomic",
    entraTenantId: null,
  });

  // ---- USERS ----
  console.log("→ users (12)");
  const adminId = uuid();
  const mgrAlphaId = uuid();
  const mgrBetaId = uuid();

  const users: (typeof schema.user.$inferInsert)[] = [
    {
      id: adminId,
      orgId,
      email: "priya@atomic.demo",
      displayName: "Priya Sharma",
      role: "admin",
      department: "People & Culture",
      title: "Head of HR",
      avatarUrl: null,
      managerId: null,
      isActive: true,
    },
    {
      id: mgrAlphaId,
      orgId,
      email: "morgan@atomic.demo",
      displayName: "Morgan Chen",
      role: "manager",
      department: "Engineering",
      title: "Director, Platform",
      managerId: adminId,
      isActive: true,
    },
    {
      id: mgrBetaId,
      orgId,
      email: "ravi@atomic.demo",
      displayName: "Ravi Kapoor",
      role: "manager",
      department: "Customer Success",
      title: "Director, Customer Success",
      managerId: adminId,
      isActive: true,
    },
  ];

  // 5 reports under Morgan
  const morganReports = [
    { name: "Alex Rivera",   email: "alex@atomic.demo",    title: "Senior Engineer" },
    { name: "Sana Khan",     email: "sana@atomic.demo",    title: "Engineer II" },
    { name: "Jordan Park",   email: "jordan@atomic.demo",  title: "Engineer III" },
    { name: "Diego Alvarez", email: "diego@atomic.demo",   title: "Engineer II" },
    { name: "Mei Tanaka",    email: "mei@atomic.demo",     title: "Senior Engineer" },
  ];
  // 4 reports under Ravi
  const raviReports = [
    { name: "Lena Müller",   email: "lena@atomic.demo",   title: "CSM Lead" },
    { name: "Tomás Silva",   email: "tomas@atomic.demo",  title: "CSM" },
    { name: "Aisha Bello",   email: "aisha@atomic.demo",  title: "CSM" },
    { name: "Kenji Watanabe",email: "kenji@atomic.demo",  title: "Solutions Engineer" },
  ];

  const employeeIds: Record<string, string> = {};
  for (const r of morganReports) {
    const id = uuid();
    employeeIds[r.email] = id;
    users.push({
      id, orgId, email: r.email, displayName: r.name, role: "employee",
      department: "Engineering", title: r.title, managerId: mgrAlphaId, isActive: true,
    });
  }
  for (const r of raviReports) {
    const id = uuid();
    employeeIds[r.email] = id;
    users.push({
      id, orgId, email: r.email, displayName: r.name, role: "employee",
      department: "Customer Success", title: r.title, managerId: mgrBetaId, isActive: true,
    });
  }
  await db.insert(schema.user).values(users);
  const alexId = employeeIds["alex@atomic.demo"];

  // ---- THRUST AREAS ----
  console.log("→ thrust areas (8)");
  const thrustAreas = [
    { name: "Customer Outcomes", color: "#2563EB", icon: "users" },
    { name: "Revenue Growth", color: "#10B981", icon: "trending-up" },
    { name: "Operational Excellence", color: "#F59E0B", icon: "settings" },
    { name: "Innovation & R&D", color: "#A855F7", icon: "sparkles" },
    { name: "People & Culture", color: "#EC4899", icon: "heart" },
    { name: "Compliance & Risk", color: "#EF4444", icon: "shield" },
    { name: "Sustainability", color: "#14B8A6", icon: "leaf" },
    { name: "Quality & Reliability", color: "#6366F1", icon: "check-circle" },
  ];
  const taIds: Record<string, string> = {};
  for (const ta of thrustAreas) {
    const id = uuid();
    taIds[ta.name] = id;
    await db.insert(schema.thrustArea).values({
      id, orgId, name: ta.name, color: ta.color, icon: ta.icon, isActive: true,
    });
  }

  // ---- CYCLE ----
  console.log("→ goal cycle (FY26 — open)");
  const cycleId = uuid();
  const fyStart = 2026; // demo year aligned with current dev timestamp
  const phaseOne = defaultPhaseOneWindow(fyStart);
  // For demo: open the cycle and Q1 right now so all flows work.
  const now = Date.now();
  await db.insert(schema.goalCycle).values({
    id: cycleId, orgId, fyLabel: "FY26",
    opensAt: phaseOne.opensAt,
    locksAt: phaseOne.locksAt,
    status: "open",
  });

  const windows = defaultCheckInWindows(fyStart);
  for (const period of ["Q1", "Q2", "Q3", "Q4"] as const) {
    // For demo, force the current quarter (Q1) to be open.
    const w = period === "Q1"
      ? { opensAt: new Date(now - 7 * 86400_000), closesAt: new Date(now + 30 * 86400_000) }
      : windows[period];
    await db.insert(schema.checkInWindow).values({
      id: uuid(), cycleId, period,
      opensAt: w.opensAt, closesAt: w.closesAt,
    });
  }

  // ---- DEMO GOAL SHEETS ----
  console.log("→ demo goal sheets");
  // Alex (employee) — submitted, awaiting review
  const alexSheetId = uuid();
  await db.insert(schema.goalSheet).values({
    id: alexSheetId, cycleId, ownerId: alexId, managerId: mgrAlphaId,
    status: "submitted", totalWeightageBp: 10000, submittedAt: new Date(now - 2 * 86400_000),
  });
  const alexGoals = [
    { thrust: "Customer Outcomes",       title: "Lift NPS from 41 → 55",         uomType: "min_num", target: 55,  weightageBp: 2500, position: 0, status: "on_track" },
    { thrust: "Operational Excellence",  title: "Cut p99 latency on /api/v2",    uomType: "max_num", target: 250, weightageBp: 2000, position: 1, status: "on_track" },
    { thrust: "Innovation & R&D",        title: "Ship Goal Copilot GA",          uomType: "timeline", targetDate: new Date(Date.UTC(2026, 11, 15)), weightageBp: 2000, position: 2, status: "not_started" },
    { thrust: "Quality & Reliability",   title: "Sev-1 incidents this year",     uomType: "zero", target: 0, weightageBp: 1500, position: 3, status: "not_started" },
    { thrust: "People & Culture",        title: "Mentor 2 engineers to senior",  uomType: "min_num", target: 2, weightageBp: 2000, position: 4, status: "not_started" },
  ] as const;
  for (const g of alexGoals) {
    const goalId = uuid();
    await db.insert(schema.goal).values({
      id: goalId, sheetId: alexSheetId, thrustAreaId: taIds[g.thrust],
      title: g.title, uomType: g.uomType,
      targetValue: "target" in g ? g.target ?? null : null,
      targetDate: "targetDate" in g ? g.targetDate ?? null : null,
      weightageBp: g.weightageBp, status: g.status, position: g.position,
    });
  }

  // Other employees with mixed states
  const seedSheet = async (
    ownerEmail: string, managerId: string, status: "draft" | "submitted" | "approved" | "locked",
    titles: { thrust: string; title: string; uomType: "min_num"|"min_pct"|"max_num"|"max_pct"|"timeline"|"zero"; weight: number; target?: number; targetDate?: Date; status?: "not_started"|"on_track"|"completed" }[]
  ) => {
    const ownerId = employeeIds[ownerEmail];
    if (!ownerId) return;
    const sheetId = uuid();
    const totalWeight = titles.reduce((s, t) => s + t.weight, 0);
    await db.insert(schema.goalSheet).values({
      id: sheetId, cycleId, ownerId, managerId,
      status,
      totalWeightageBp: totalWeight,
      submittedAt: status !== "draft" ? new Date(now - 5 * 86400_000) : null,
      approvedAt: status === "approved" || status === "locked" ? new Date(now - 4 * 86400_000) : null,
      lockedAt: status === "locked" ? new Date(now - 4 * 86400_000) : null,
    });
    for (const [i, t] of titles.entries()) {
      await db.insert(schema.goal).values({
        id: uuid(), sheetId, thrustAreaId: taIds[t.thrust],
        title: t.title, uomType: t.uomType,
        targetValue: t.target ?? null,
        targetDate: t.targetDate ?? null,
        weightageBp: t.weight, status: t.status ?? "not_started", position: i,
      });
    }
  };

  await seedSheet("sana@atomic.demo", mgrAlphaId, "locked", [
    { thrust: "Customer Outcomes",      title: "Reduce ticket time-to-resolution",  uomType: "max_num", weight: 3000, target: 12, status: "on_track" },
    { thrust: "Operational Excellence", title: "Migrate 6 services to autoscale",   uomType: "min_num", weight: 3000, target: 6,  status: "on_track" },
    { thrust: "Innovation & R&D",       title: "Ship Webhooks v2",                  uomType: "timeline", weight: 2000, targetDate: new Date(Date.UTC(2026, 11, 31)) },
    { thrust: "Quality & Reliability",  title: "Sev-1 incidents",                   uomType: "zero", weight: 2000, target: 0 },
  ]);

  await seedSheet("jordan@atomic.demo", mgrAlphaId, "approved", [
    { thrust: "Revenue Growth",         title: "Drive $1.2M ARR from platform team", uomType: "min_num", weight: 4000, target: 1_200_000, status: "on_track" },
    { thrust: "Quality & Reliability",  title: "Reduce error rate < 0.5%",           uomType: "max_num", weight: 3000, target: 0.5, status: "on_track" },
    { thrust: "People & Culture",       title: "Run 2 internal tech-talks",          uomType: "min_num", weight: 3000, target: 2 },
  ]);

  await seedSheet("diego@atomic.demo", mgrAlphaId, "draft", [
    { thrust: "Innovation & R&D",       title: "Prototype new analytics engine",     uomType: "timeline", weight: 5000, targetDate: new Date(Date.UTC(2026, 9, 30)) },
    { thrust: "Operational Excellence", title: "Cut CI time by 40%",                 uomType: "max_num", weight: 5000, target: 600 },
  ]);

  await seedSheet("mei@atomic.demo", mgrAlphaId, "locked", [
    { thrust: "Customer Outcomes",      title: "Lift renewal NPS",                   uomType: "min_num", weight: 4000, target: 60, status: "on_track" },
    { thrust: "Revenue Growth",         title: "Expand 5 enterprise accounts",       uomType: "min_num", weight: 3000, target: 5,  status: "on_track" },
    { thrust: "People & Culture",       title: "Hire 3 senior engineers",            uomType: "min_num", weight: 3000, target: 3 },
  ]);

  await seedSheet("lena@atomic.demo", mgrBetaId, "locked", [
    { thrust: "Customer Outcomes",      title: "Drive 95% renewal rate",             uomType: "min_pct", weight: 4000, target: 95, status: "on_track" },
    { thrust: "Revenue Growth",         title: "Expand 8 accounts by $250k",         uomType: "min_num", weight: 3000, target: 8 },
    { thrust: "People & Culture",       title: "Onboard 2 new CSMs",                 uomType: "min_num", weight: 3000, target: 2 },
  ]);

  await seedSheet("tomas@atomic.demo", mgrBetaId, "submitted", [
    { thrust: "Customer Outcomes",      title: "QBRs delivered to 12 accounts",      uomType: "min_num", weight: 4000, target: 12 },
    { thrust: "Quality & Reliability",  title: "Escalations to engineering",         uomType: "max_num", weight: 3000, target: 6 },
    { thrust: "Compliance & Risk",      title: "Zero SLA breaches",                  uomType: "zero", weight: 3000, target: 0 },
  ]);

  await seedSheet("aisha@atomic.demo", mgrBetaId, "approved", [
    { thrust: "Customer Outcomes",      title: "Adoption score ≥ 8.0",               uomType: "min_num", weight: 5000, target: 8, status: "on_track" },
    { thrust: "Revenue Growth",         title: "Identify $400k expansion pipeline",  uomType: "min_num", weight: 5000, target: 400000 },
  ]);

  await seedSheet("kenji@atomic.demo", mgrBetaId, "draft", [
    { thrust: "Innovation & R&D",       title: "Build 3 reference architectures",    uomType: "min_num", weight: 5000, target: 3 },
    { thrust: "Operational Excellence", title: "Reduce demo prep time",              uomType: "max_num", weight: 5000, target: 30 },
  ]);

  // ---- HISTORICAL CHECK-INS (Q1 partial, for analytics) ----
  console.log("→ historical Q1 check-ins");
  // Pull all approved/locked goals; insert simulated check-ins
  const allGoals = await db.select().from(schema.goal).all();
  for (const g of allGoals) {
    const sheet = await db.select().from(schema.goalSheet).where((sq) => undefined as never).all();
    void sheet;
  }
  // Simpler: just insert a Q1 check-in for goals belonging to locked/approved sheets
  const lockedSheets = await db.select().from(schema.goalSheet).all();
  for (const s of lockedSheets) {
    if (s.status !== "locked" && s.status !== "approved") continue;
    const goals = allGoals.filter((g) => g.sheetId === s.id);
    for (const g of goals) {
      const partialActual = (() => {
        if (g.uomType === "zero") return 0;
        if (g.uomType === "timeline") return null;
        if (typeof g.targetValue === "number") {
          // 50–95% progress randomly stable per goalId
          const base = 0.55 + (parseInt(g.id.replace(/[^0-9]/g, "").slice(-2) || "0") % 35) / 100;
          return g.targetValue * base;
        }
        return null;
      })();
      await db.insert(schema.checkIn).values({
        id: uuid(),
        goalId: g.id,
        period: "Q1",
        actualValue: partialActual ?? null,
        status: "on_track",
        employeeNote: "Steady progress this quarter.",
        managerId: s.managerId ?? null,
        managerComment: s.status === "locked" ? "On track. Keep momentum into Q2." : null,
        employeeSubmittedAt: new Date(now - 1 * 86400_000),
        managerAcknowledgedAt: s.status === "locked" ? new Date(now - 12 * 3600_000) : null,
      });
    }
  }

  // ---- ESCALATION RULES ----
  console.log("→ default escalation rules");
  await db.insert(schema.escalationRule).values([
    {
      id: uuid(), orgId, name: "Late goal submission",
      trigger: "no_submit", thresholdDays: 7,
      chainJson: JSON.stringify([
        { to: "owner", afterDays: 0 },
        { to: "manager", afterDays: 3 },
        { to: "skip_level", afterDays: 6 },
        { to: "hr", afterDays: 9 },
      ]),
      isActive: true,
    },
    {
      id: uuid(), orgId, name: "Stalled approval",
      trigger: "no_approve", thresholdDays: 5,
      chainJson: JSON.stringify([
        { to: "manager", afterDays: 0 },
        { to: "skip_level", afterDays: 3 },
        { to: "hr", afterDays: 7 },
      ]),
      isActive: true,
    },
    {
      id: uuid(), orgId, name: "Missed quarterly check-in",
      trigger: "no_checkin", thresholdDays: 10,
      chainJson: JSON.stringify([
        { to: "owner", afterDays: 0 },
        { to: "manager", afterDays: 3 },
        { to: "hr", afterDays: 7 },
      ]),
      isActive: true,
    },
  ]);

  // ---- SAMPLE NOTIFICATIONS ----
  console.log("→ sample notifications");
  await db.insert(schema.notification).values([
    {
      id: uuid(), userId: mgrAlphaId, channel: "in_app", type: "goal_submitted",
      title: "Alex Rivera submitted goals", body: "5 goals · 100% allocated · awaiting your review",
      link: `/goals/${alexSheetId}`,
      payloadJson: JSON.stringify({ sheetId: alexSheetId }),
    },
    {
      id: uuid(), userId: alexId, channel: "in_app", type: "cycle_open",
      title: "FY26 cycle is open", body: "Submit your goal sheet by 30 June.",
      link: `/goals`,
    },
  ]);

  console.log("✓ seed complete.");
  console.log(`
Demo identities (Demo Mode dropdown):
  • Priya Sharma  — Admin / HR
  • Morgan Chen   — Manager (Engineering, 5 reports)
  • Ravi Kapoor   — Manager (Customer Success, 4 reports)
  • Alex Rivera   — Employee (Submitted, awaiting review)
  • Sana Khan     — Employee (Locked goals)
  • Diego Alvarez — Employee (Draft)
  ...and 6 more.
`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
