import { z } from "zod";
import type { UomType } from "@/lib/domain/scoring";

export const SkillNames = [
  "generateSmartGoal",
  "improveGoalClarity",
  "suggestKpi",
  "summarizeQuarter",
  "predictCompletionRisk",
  "managerCopilot",
  "goalAlignmentCheck",
  "semanticSearch",
] as const;
export type SkillName = (typeof SkillNames)[number];

const UomEnum = z.enum(["min_num", "min_pct", "max_num", "max_pct", "timeline", "zero"]) as z.ZodType<UomType>;

export const skillSchemas = {
  generateSmartGoal: {
    input: z.object({
      role: z.string().optional(),
      department: z.string().nullable().optional(),
      hint: z.string().optional(),
      existingTitles: z.array(z.string()).optional(),
    }),
    output: z.object({
      title: z.string(),
      description: z.string(),
      uomType: UomEnum,
      target: z.number().nullable().optional(),
      targetDate: z.string().nullable().optional(),
      weightageBp: z.number().int(),
      thrustAreaName: z.string().nullable().optional(),
      kpis: z.array(z.string()).optional(),
    }),
  },
  improveGoalClarity: {
    input: z.object({ title: z.string(), description: z.string().optional() }),
    output: z.object({ rewrite: z.string(), diff: z.string(), rationale: z.string() }),
  },
  suggestKpi: {
    input: z.object({ thrustAreaName: z.string().optional(), role: z.string().optional() }),
    output: z.object({
      kpis: z.array(z.object({ title: z.string(), target: z.number(), uom: UomEnum })),
    }),
  },
  predictCompletionRisk: {
    input: z.object({
      goalTitle: z.string(),
      status: z.enum(["not_started", "on_track", "completed"]),
    }),
    output: z.object({
      risk: z.enum(["low", "med", "high"]),
      signals: z.array(z.string()),
      recommendation: z.string(),
    }),
  },
  summarizeQuarter: {
    input: z.object({ period: z.enum(["Q1", "Q2", "Q3", "Q4"]) }),
    output: z.object({ summary: z.string(), bullets: z.array(z.string()) }),
  },
  managerCopilot: {
    input: z.object({ reportName: z.string() }),
    output: z.object({
      talkingPoints: z.array(z.string()),
      questions: z.array(z.string()),
    }),
  },
  goalAlignmentCheck: {
    input: z.object({ titles: z.array(z.string()) }),
    output: z.object({
      aligned: z.boolean(),
      gaps: z.array(z.string()),
      suggestions: z.array(z.string()),
    }),
  },
  semanticSearch: {
    input: z.object({ query: z.string() }),
    output: z.object({
      results: z.array(z.object({ id: z.string(), kind: z.string(), title: z.string(), score: z.number(), snippet: z.string() })),
    }),
  },
} as const;

export type SkillIO<K extends SkillName> = {
  input: z.infer<(typeof skillSchemas)[K]["input"]>;
  output: z.infer<(typeof skillSchemas)[K]["output"]>;
};
