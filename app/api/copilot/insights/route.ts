import { NextResponse } from "next/server";
import { generateText } from "ai";
import { getSession } from "@/lib/auth/session";
import { getAiMode, getModel } from "@/lib/ai/gateway";
import { getOrCreateSheetForUser, getActiveCycle, listGoalsForSheets, getCheckInsForGoals } from "@/lib/db/queries";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cycle = await getActiveCycle(session.orgId);
  if (!cycle) return NextResponse.json({ insights: [] });

  const sheet = await getOrCreateSheetForUser({ cycleId: cycle.id, ownerId: session.userId, managerId: session.managerId });
  const goals = await listGoalsForSheets([sheet.id]);
  const checkIns = await getCheckInsForGoals(goals.map((g) => g.id));

  if (!goals.length) {
    return NextResponse.json({ insights: [{ icon: "sparkles", title: "Get started", body: "Add goals to your sheet to receive AI-powered insights." }] });
  }

  const mode = getAiMode();
  if (mode === "stub") {
    return NextResponse.json({ insights: generateStubInsights(goals, checkIns) });
  }

  try {
    const model = getModel("fast");
    const goalsContext = goals.map((g) => ({
      title: g.title,
      uom: g.uomType,
      target: g.targetValue,
      weight: `${(g.weightageBp / 100).toFixed(0)}%`,
      status: g.status,
      actual: g.currentActual,
      score: g.computedScoreBp != null ? `${(g.computedScoreBp / 100).toFixed(0)}%` : "not scored",
    }));

    const q1Submitted = checkIns.filter((c) => c.period === "Q1" && c.employeeSubmittedAt).length;
    const totalGoals = goals.length;

    const prompt = `You are an AI performance coach for an enterprise goal-tracking system. Analyze this employee's goals and generate exactly 3 short, actionable insights. Be specific — reference actual goal titles and numbers.

Goals:
${JSON.stringify(goalsContext, null, 2)}

Check-in status: ${q1Submitted}/${totalGoals} Q1 check-ins submitted.
Sheet status: ${sheet.status}

Return ONLY a JSON array of 3 objects, each with "icon" (one of: "alert", "zap", "sparkles"), "title" (max 5 words), and "body" (max 30 words, specific and actionable). No markdown, no explanation.`;

    const { text } = await generateText({
      model,
      prompt,
      temperature: 0.4,
      maxOutputTokens: 512,
    });

    const parsed = JSON.parse(text.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, ""));
    if (Array.isArray(parsed) && parsed.length >= 1) {
      return NextResponse.json({ insights: parsed.slice(0, 3) });
    }
    return NextResponse.json({ insights: generateStubInsights(goals, checkIns) });
  } catch (e) {
    console.error("[copilot/insights]", e);
    return NextResponse.json({ insights: generateStubInsights(goals, checkIns) });
  }
}

function generateStubInsights(goals: any[], checkIns: any[]) {
  const atRisk = goals.filter((g) => g.status === "not_started" && g.computedScoreBp === 0);
  const onTrack = goals.filter((g) => g.status === "on_track");
  const submitted = checkIns.filter((c) => c.employeeSubmittedAt).length;

  const insights = [];

  if (atRisk.length > 0) {
    insights.push({
      icon: "alert",
      title: `${atRisk.length} goal${atRisk.length > 1 ? "s" : ""} need attention`,
      body: `"${atRisk[0].title}" hasn't started yet. Log progress or update status to stay on track.`,
    });
  }

  if (onTrack.length > 0) {
    insights.push({
      icon: "zap",
      title: "Momentum building",
      body: `${onTrack.length} goal${onTrack.length > 1 ? "s" : ""} on track. "${onTrack[0].title}" is progressing well — keep it up.`,
    });
  }

  if (submitted < goals.length) {
    insights.push({
      icon: "sparkles",
      title: "Check-ins pending",
      body: `${submitted}/${goals.length} Q1 check-ins submitted. Complete the rest to boost your composite score.`,
    });
  }

  if (insights.length === 0) {
    insights.push({ icon: "sparkles", title: "All clear", body: "Your goals are on track. Keep up the great work this quarter." });
  }

  return insights.slice(0, 3);
}
