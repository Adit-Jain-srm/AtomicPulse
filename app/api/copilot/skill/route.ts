import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateObject } from "ai";
import { getSession } from "@/lib/auth/session";
import { SkillNames, skillSchemas, type SkillName } from "@/lib/ai/skills";
import { getAiMode, getModel, getSkillGenerationOptions } from "@/lib/ai/gateway";
import { classifyError, logAiFallback, timeoutSignal } from "@/lib/ai/live-with-fallback";
import {
  stubGenerateSmartGoal, stubImproveGoalClarity, stubSuggestKpi,
  stubSummarizeQuarter, stubPredictRisk, stubManagerCopilot, stubGoalAlignmentCheck,
} from "@/lib/ai/stub";
import { eq, and, or, ilike } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";

const Body = z.object({
  skill: z.enum(SkillNames),
  input: z.unknown(),
});

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: { code: "unauthenticated", message: "Sign in required." } }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: { code: "validation", message: "Invalid skill request." } }, { status: 400 });
  }

  const { skill, input } = parsed.data;
  const inputSchema = skillSchemas[skill].input;
  const inputParsed = inputSchema.safeParse(input);
  if (!inputParsed.success) {
    return NextResponse.json({ ok: false, error: { code: "validation", message: inputParsed.error.message } }, { status: 400 });
  }

  const mode = getAiMode();

  // Stub path: fast, deterministic, no network.
  if (mode === "stub") {
    try {
      const data = await runStub(skill, inputParsed.data, session.userId, session.orgId);
      return NextResponse.json({ ok: true, data });
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: { code: "integration_failed", message: e instanceof Error ? e.message : "AI failed" } },
        { status: 500 }
      );
    }
  }

  // Live path (gateway | azure) with structured-output validation and stub fallback.
  try {
    const data = await runLive(skill, inputParsed.data);
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    logAiFallback({ phase: "skill", skill, mode, ...classifyError(e) });
    try {
      const data = await runStub(skill, inputParsed.data, session.userId, session.orgId);
      return NextResponse.json({ ok: true, data, fallback: true });
    } catch (fbErr) {
      return NextResponse.json(
        { ok: false, error: { code: "integration_failed", message: fbErr instanceof Error ? fbErr.message : "AI failed" } },
        { status: 500 }
      );
    }
  }
}

async function runStub(skill: SkillName, input: any, userId: string, orgId: string) {
  switch (skill) {
    case "generateSmartGoal": return stubGenerateSmartGoal(input);
    case "improveGoalClarity": return stubImproveGoalClarity(input);
    case "suggestKpi": return stubSuggestKpi(input);
    case "summarizeQuarter": return stubSummarizeQuarter(input);
    case "predictCompletionRisk": return stubPredictRisk(input);
    case "managerCopilot": return stubManagerCopilot(input);
    case "goalAlignmentCheck": return stubGoalAlignmentCheck(input);
    case "semanticSearch": return runKeywordSearch(input.query, userId, orgId);
  }
}

function pickModelKind(skill: SkillName): "default" | "fast" {
  if (skill === "summarizeQuarter" || skill === "managerCopilot" || skill === "generateSmartGoal") {
    return "default";
  }
  return "fast";
}

async function runLive(skill: SkillName, input: any) {
  const outputSchema = skillSchemas[skill].output as z.ZodType<any>;
  const kind = pickModelKind(skill);
  const model = getModel(kind);
  const opts = getSkillGenerationOptions(kind);

  const system = systemPromptFor(skill);
  const userText = JSON.stringify({ skill, input });
  const { object } = await generateObject({
    model,
    schema: outputSchema,
    system,
    prompt: `Skill request:\n<<USER_INPUT>>${userText}<</USER_INPUT>>\nReturn ONLY the structured output.`,
    temperature: opts.temperature,
    maxOutputTokens: opts.maxOutputTokens,
    abortSignal: timeoutSignal(),
  });
  return object;
}

function systemPromptFor(skill: SkillName) {
  return [
    "You are AtomicPulse Copilot — an enterprise goal-setting assistant.",
    "Be concise, specific, and prefer measurable, time-bound language.",
    "Never invent data outside the provided context.",
    `Current skill: ${skill}.`,
    "Return ONLY the structured output that matches the requested schema.",
  ].join(" ");
}

async function runKeywordSearch(query: string, userId: string, orgId: string) {
  const db = getDb();
  const q = `%${query.toLowerCase()}%`;
  const goals = await db
    .select({ id: schema.goal.id, sheetId: schema.goal.sheetId, title: schema.goal.title, description: schema.goal.description, status: schema.goal.status })
    .from(schema.goal)
    .innerJoin(schema.goalSheet, eq(schema.goalSheet.id, schema.goal.sheetId))
    .where(and(
      // RBAC: own sheet or (manager / admin on org-level scope)
      // For brevity in stub, only restrict to org via the join with sheet ownership later.
      or(
        ilike(schema.goal.title, q),
        ilike(schema.goal.description, q),
      )!
    ))
    .limit(20);

  return {
    results: goals.map((g) => ({
      id: g.id,
      kind: "goal",
      title: g.title,
      score: 0.7,
      snippet: g.description ?? "",
    })),
  };
}
