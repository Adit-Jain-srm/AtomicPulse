import type { UomType } from "@/lib/domain/scoring";

const SAMPLE_TITLES = [
  "Drive 25% YoY revenue growth in mid-market segment",
  "Reduce p99 API latency below 250ms across core services",
  "Lift renewal NPS from 42 to 58",
  "Ship Goal Copilot 1.0 to GA",
  "Achieve zero Sev-1 incidents across the platform",
  "Mentor 3 engineers to senior level by FY end",
  "Cut quarterly ticket TAT to under 8 hours",
  "Land 4 strategic enterprise logos",
];

const SAMPLE_DESCRIPTIONS = [
  "Drive a measurable, sustained shift in the metric. Define a baseline by Q1, ship instrumentation, and run weekly scorecards with the partner team.",
  "Define a clear baseline, instrument the path, and remove blockers without trading off reliability or compliance posture.",
  "Anchor on customer outcomes. Ship the highest-leverage 3 actions before mid-Q2 and review weekly.",
];

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function hashSeed(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export function stubGenerateSmartGoal(input: { role?: string; department?: string | null; existingTitles?: string[] }) {
  const seed = hashSeed((input.role ?? "") + (input.department ?? "") + (input.existingTitles?.length ?? 0));
  const title = pick(SAMPLE_TITLES, seed);
  return {
    title,
    description: pick(SAMPLE_DESCRIPTIONS, seed + 1),
    uomType: "min_num" as UomType,
    target: 25,
    targetDate: null as string | null,
    weightageBp: 2000,
    thrustAreaName: "Customer Outcomes",
    kpis: ["Weekly trendline review", "Monthly executive readout"],
  };
}

export function stubImproveGoalClarity(input: { title: string; description?: string }) {
  return {
    rewrite: `${input.title.replace(/\.+$/, "")} — measured weekly with a clear baseline and sustained over the quarter.`,
    diff: "Tightened verb, added measurement cadence and time horizon.",
    rationale:
      "Original goal lacked a measurement cadence and a time horizon. The rewrite makes the metric observable and sets a quarterly check.",
  };
}

export function stubSuggestKpi(input: { thrustAreaName?: string; role?: string }) {
  const base = input.thrustAreaName ?? "Customer Outcomes";
  return {
    kpis: [
      { title: `${base} index ≥ 70`, target: 70, uom: "min_num" as UomType },
      { title: `${base} time-to-value < 14 days`, target: 14, uom: "max_num" as UomType },
      { title: `${base} retention ≥ 95%`, target: 95, uom: "min_pct" as UomType },
    ],
  };
}

export function stubPredictRisk(input: { goalTitle: string; status: "not_started" | "on_track" | "completed" }) {
  if (input.status === "completed") {
    return {
      risk: "low" as const,
      signals: ["Marked completed in last check-in"],
      recommendation: "Capture learnings and close the loop in your next 1:1.",
    };
  }
  if (input.status === "not_started") {
    return {
      risk: "high" as const,
      signals: ["No actuals recorded", "Status remains 'not started' past Q1 open"],
      recommendation: "Ship a small first milestone this week to unblock momentum.",
    };
  }
  return {
    risk: "med" as const,
    signals: ["Last update was 2+ weeks ago", "Trajectory matches plan but slack consumed"],
    recommendation: "Lock the next two milestones with dates and bring them to your manager 1:1.",
  };
}

export function stubSummarizeQuarter(input: { period: "Q1" | "Q2" | "Q3" | "Q4" }) {
  const bullets = [
    `Completed 4 of 7 ${input.period} milestones; revenue goal tracking 12% ahead of plan.`,
    "Two reliability initiatives slipped — rebalanced ownership; risk now medium.",
    "Mentorship goal under-reported in check-ins; recommend a status nudge before next 1:1.",
    "Three open items carry into next period; weight redistribution suggested in copilot.",
  ];
  return {
    summary: `In ${input.period}, the team executed strongly on customer outcomes while reliability work fell behind plan. Composite weighted score: 72%. Two goals at risk; recommended action items below.`,
    bullets,
  };
}

export function stubManagerCopilot(input: { reportName: string }) {
  return {
    talkingPoints: [
      `Acknowledge ${input.reportName}'s strong progress on the revenue goal — ahead of plan.`,
      "Probe the timeline goal — last update was 3 weeks ago and the risk is rising.",
      "Discuss whether the mentorship goal still has the right scope; weight may be too low.",
    ],
    questions: [
      "What's blocking your check-in cadence?",
      "Is there a decision you're stuck on that I can help unblock?",
    ],
  };
}

export function stubGoalAlignmentCheck(_input: { titles: string[] }) {
  return {
    aligned: true as const,
    gaps: [],
    suggestions: [
      "Consider adding a Quality & Reliability goal to balance the customer-outcomes weighting.",
    ],
  };
}
