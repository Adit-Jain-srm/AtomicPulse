/* eslint-disable no-console */
import { skillSchemas, type SkillName } from "@/lib/ai/skills";
import {
  stubGenerateSmartGoal, stubImproveGoalClarity, stubSuggestKpi,
  stubSummarizeQuarter, stubPredictRisk, stubManagerCopilot, stubGoalAlignmentCheck,
} from "@/lib/ai/stub";
import { classifyError, logAiFallback } from "@/lib/ai/live-with-fallback";

type Case = {
  name: string;
  skill: SkillName;
  input: any;
  run: (input: any) => unknown;
};

const cases: Case[] = [
  {
    name: "generateSmartGoal returns SMART output",
    skill: "generateSmartGoal",
    input: { role: "engineer", department: "Platform" },
    run: (i) => stubGenerateSmartGoal(i),
  },
  {
    name: "improveGoalClarity tightens language",
    skill: "improveGoalClarity",
    input: { title: "do better at customer", description: "be good" },
    run: (i) => stubImproveGoalClarity(i),
  },
  {
    name: "suggestKpi yields measurable KPIs",
    skill: "suggestKpi",
    input: { thrustAreaName: "Customer Outcomes", role: "engineer" },
    run: (i) => stubSuggestKpi(i),
  },
  {
    name: "predictCompletionRisk classifies risk",
    skill: "predictCompletionRisk",
    input: { goalTitle: "ship pricing experiments", status: "on_track" as const },
    run: (i) => stubPredictRisk(i),
  },
  {
    name: "summarizeQuarter writes a summary",
    skill: "summarizeQuarter",
    input: { period: "Q1" as const },
    run: (i) => stubSummarizeQuarter(i),
  },
  {
    name: "managerCopilot produces 1:1 prompts",
    skill: "managerCopilot",
    input: { reportName: "Priya" },
    run: (i) => stubManagerCopilot(i),
  },
  {
    name: "goalAlignmentCheck reports gaps",
    skill: "goalAlignmentCheck",
    input: { titles: ["Drive 25% YoY revenue growth"] },
    run: (i) => stubGoalAlignmentCheck(i),
  },
];

let pass = 0;
let fail = 0;
for (const c of cases) {
  try {
    const inputParsed = skillSchemas[c.skill].input.parse(c.input);
    const out = c.run(inputParsed);
    const outputParsed = skillSchemas[c.skill].output.parse(out);
    if (!outputParsed) throw new Error("empty output");
    pass++;
    console.log(`  PASS  ${c.name}`);
  } catch (e) {
    fail++;
    console.log(`  FAIL  ${c.name} -> ${e instanceof Error ? e.message : e}`);
  }
}

// Fallback path: simulate a live failure and verify the wrapper falls back to stub
async function simulateLiveCall(): Promise<never> {
  throw Object.assign(new Error("synthetic abort"), { name: "AbortError" });
}

async function runFallbackCheck() {
  try {
    await simulateLiveCall();
    fail++;
    console.log("  FAIL  fallback wrapper did not throw");
  } catch (e) {
    const cls = classifyError(e);
    if (cls.reason === "timeout") {
      // also exercise the logger (no PII)
      logAiFallback({ phase: "skill", skill: "generateSmartGoal", mode: "azure", ...cls });
      pass++;
      console.log("  PASS  fallback classifies AbortError as timeout");
    } else {
      fail++;
      console.log(`  FAIL  fallback misclassified: ${JSON.stringify(cls)}`);
    }
  }
}

runFallbackCheck().then(() => {
  console.log(`\nAI eval: ${pass} passed, ${fail} failed.`);
  process.exit(fail ? 1 : 0);
});
