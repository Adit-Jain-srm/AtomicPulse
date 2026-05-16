import { NextRequest } from "next/server";
import { streamText } from "ai";
import { getSession } from "@/lib/auth/session";
import { getAiMode, getModel } from "@/lib/ai/gateway";
import { classifyError, logAiFallback, timeoutSignal } from "@/lib/ai/live-with-fallback";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `
You are AtomicPulse Copilot — an enterprise goal-setting and tracking assistant.
You help employees draft SMART goals, suggest KPIs, summarise check-ins, and flag risks.
You are concise, specific, and avoid jargon.
You never reveal data the user is not authorised to see; the platform scopes context for you.
When the user asks for a goal, return a single goal in plain language with a clear metric and time horizon.
`.trim();

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { messages } = (await req.json().catch(() => ({}))) as { messages?: { role: "user" | "assistant" | "system"; content: string }[] };
  if (!messages?.length) return new Response("Bad Request", { status: 400 });

  const mode = getAiMode();
  if (mode === "stub") {
    return stubStream(messages);
  }

  try {
    const result = await streamText({
      model: getModel("default"),
      system: SYSTEM_PROMPT,
      messages: messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content })) as any,
      temperature: 0.5,
      abortSignal: timeoutSignal(),
    });
    return result.toTextStreamResponse();
  } catch (e) {
    logAiFallback({ phase: "chat", mode, ...classifyError(e) });
    return stubStream(messages);
  }
}

function stubStream(messages: { role: string; content: string }[]) {
  const last = messages[messages.length - 1]?.content?.toLowerCase() ?? "";
  const reply = composeStubReply(last);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const tokens = reply.split(/(\s+)/);
      for (const t of tokens) {
        controller.enqueue(encoder.encode(t));
        await new Promise((r) => setTimeout(r, 18));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function composeStubReply(input: string) {
  if (/(smart|generate|draft).*goal/i.test(input) || /draft a smart goal/i.test(input)) {
    return [
      "Here's a SMART goal you can drop straight into your sheet:",
      "",
      "**Lift mid-market renewal NPS from 42 → 58 by FY end.**",
      "",
      "• Owner: you  · Thrust: Customer Outcomes",
      "• UoM: Min · Numeric  · Target: 58  · Weightage: 25%",
      "• Cadence: weekly trendline review with the customer team; monthly executive readout.",
      "",
      "Want me to add it to your sheet?",
    ].join("\n");
  }
  if (/summari[sz]e|quarter/i.test(input)) {
    return [
      "**Q1 summary**",
      "Composite weighted score: 72%. Two goals at risk; one ahead of plan.",
      "",
      "• Revenue · 12% ahead of plan (drove $1.05M of $1.2M ARR commitment).",
      "• Reliability · trailing — error rate 0.7% vs 0.5% target; ownership rebalanced.",
      "• Mentorship · under-reported in check-ins; recommend a status nudge.",
      "",
      "Action: ship one milestone on the at-risk goals before next 1:1.",
    ].join("\n");
  }
  if (/kpi|metric|measure/i.test(input)) {
    return [
      "Three KPIs you could pair with this goal:",
      "1. **Outcome index ≥ 70** (Min · Numeric) — catches the headline trend.",
      "2. **Time-to-value < 14 days** (Max · Numeric) — early warning indicator.",
      "3. **Quarterly retention ≥ 95%** (Min · %) — durability signal.",
    ].join("\n");
  }
  if (/risk|delay|behind/i.test(input)) {
    return [
      "**Risk read on your active goals**",
      "• HIGH: 'Ship Goal Copilot GA' — last update 3w ago; deadline drift > 14d.",
      "• MED: 'Reduce p99 latency' — actuals trail plan by 18%.",
      "• LOW: everything else.",
      "",
      "Recommendation: scope down the GA goal or pull a partner; bring it to your next 1:1.",
    ].join("\n");
  }
  if (/search|find/i.test(input)) {
    return "Try the command palette — press ⌘K and start typing. I'll search across your goals, check-ins, and people.";
  }
  return [
    "I'm running in offline demo mode (no AI key set), so I'll keep this short:",
    "",
    "I can draft SMART goals, summarise quarters, suggest KPIs, or flag risk. Try one of the chips below.",
  ].join("\n");
}
