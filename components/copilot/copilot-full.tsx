"use client";
import * as React from "react";
import { motion } from "framer-motion";
import { Sparkles, Send, Wand2, ListChecks, Activity, FileSearch, AlertTriangle, Users, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/dashboards/shared";
import type { Role } from "@/lib/auth/session";

type Msg = { id: string; role: "user" | "assistant" | "system"; content: string; pending?: boolean };

const SKILL_PRESETS = [
  { skill: "generateSmartGoal", icon: Wand2, label: "Draft a SMART goal", prompt: "Help me draft a SMART goal for my role this quarter." },
  { skill: "summarizeQuarter", icon: Activity, label: "Summarise my quarter", prompt: "Summarise how my quarter is tracking and call out anything off-track." },
  { skill: "suggestKpi", icon: ListChecks, label: "Suggest a KPI", prompt: "Suggest a few measurable KPIs that align with my current goals." },
  { skill: "predictCompletionRisk", icon: AlertTriangle, label: "Predict risk", prompt: "Which of my goals are at risk and why?" },
  { skill: "managerCopilot", icon: Users, label: "Coach me as a manager", prompt: "Give me coaching prompts for my next 1:1.", roles: ["manager", "admin"] as Role[] },
  { skill: "goalAlignmentCheck", icon: Target, label: "Check alignment", prompt: "Are my goals well-aligned to the org thrust areas?" },
  { skill: "semanticSearch", icon: FileSearch, label: "Search my history", prompt: "Find goals similar to ‘reduce time-to-resolve incidents’ across recent quarters." },
];

export function CopilotFullClient({ role, userName }: { role: Role; userName: string }) {
  const [messages, setMessages] = React.useState<Msg[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Hi ${userName.split(" ")[0]} — ask me anything about your goals, KPIs, check-ins, or your team. I run with full RBAC scoping.`,
    },
  ]);
  const [input, setInput] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(prompt: string) {
    if (!prompt.trim() || pending) return;
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: prompt };
    const assistantMsg: Msg = { id: crypto.randomUUID(), role: "assistant", content: "", pending: true };
    setMessages((m) => [...m, userMsg, assistantMsg]);
    setInput("");
    setPending(true);
    try {
      const res = await fetch("/api/copilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok || !res.body) throw new Error("Copilot unavailable");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: acc, pending: true } : m))
        );
      }
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsg.id ? { ...m, pending: false } : m))
      );
    } catch (e) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: e instanceof Error ? e.message : "Copilot is unavailable.", pending: false }
            : m,
        ),
      );
    } finally {
      setPending(false);
    }
  }

  const visiblePresets = SKILL_PRESETS.filter((p) => !p.roles || p.roles.includes(role));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI"
        title="Goal Copilot"
        description="Inline AI for drafting, refining, and reasoning over your goals — streamed, structured, and audit-aware."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="flex h-[min(68dvh,800px)] flex-col">
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-5">
            {messages.map((m) => (
              <Bubble key={m.id} msg={m} />
            ))}
          </div>
          <div className="border-t border-[hsl(var(--border-subtle))] p-3">
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask the copilot anything…"
                disabled={pending}
                className="h-11 flex-1 rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] px-3.5 text-sm placeholder:text-[hsl(var(--fg-muted))] focus-ring"
              />
              <Button variant="ai" type="submit" disabled={pending || !input.trim()} aria-label="Send">
                <Send className="size-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Send</span>
              </Button>
            </form>
            <p className="mt-2 text-[10px] text-[hsl(var(--fg-muted))]">
              Outputs are scoped to <code>{role}</code> permissions. Drafts are not stored unless you save them.
            </p>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 border-b border-[hsl(var(--border-subtle))] p-5">
            <Sparkles className="size-4 text-[hsl(var(--accent))]" />
            <div className="text-sm font-semibold">Skills</div>
          </div>
          <CardContent className="space-y-1.5 p-3">
            {visiblePresets.map((p, i) => {
              const I = p.icon;
              return (
                <motion.button
                  key={p.skill}
                  onClick={() => send(p.prompt)}
                  disabled={pending}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-md border border-transparent bg-[hsl(var(--surface-1))] px-3 py-2.5 text-left transition-colors",
                    "hover:border-[hsl(var(--border-subtle))] hover:bg-[hsl(var(--surface-2))]",
                    "disabled:opacity-50",
                  )}
                >
                  <I className="mt-0.5 size-4 text-[hsl(var(--accent))]" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{p.label}</div>
                    <div className="truncate text-[11px] text-[hsl(var(--fg-muted))]">{p.prompt}</div>
                  </div>
                </motion.button>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-[hsl(var(--accent))] text-white"
            : "border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))]",
        )}
      >
        {msg.content || (msg.pending && <span className="ai-shimmer block h-3 w-32 rounded-full" />)}
      </div>
    </div>
  );
}
