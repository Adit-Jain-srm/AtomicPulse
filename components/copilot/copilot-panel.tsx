"use client";
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Send, Wand2, ListChecks, Activity, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Session } from "@/lib/auth/session";

type Msg = { id: string; role: "user" | "assistant" | "system"; content: string; pending?: boolean };

const QUICK_SKILLS = [
  { skill: "generateSmartGoal", icon: Wand2, label: "Draft a SMART goal" },
  { skill: "summarizeQuarter", icon: Activity, label: "Summarise my quarter" },
  { skill: "suggestKpi", icon: ListChecks, label: "Suggest a KPI" },
  { skill: "semanticSearch", icon: FileSearch, label: "Search my goals" },
];

export function CopilotPanel({
  session,
  open,
  onOpenChange,
}: {
  session: Session;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [messages, setMessages] = React.useState<Msg[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Hi ${session.displayName.split(" ")[0]} — I'm your goal copilot. Ask me to draft a SMART goal, summarise your quarter, suggest KPIs, or just type what's on your mind.`,
    },
  ]);
  const [input, setInput] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

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
        body: JSON.stringify({ messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })) }),
      });
      if (!res.ok || !res.body) throw new Error("Copilot unavailable");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      // Read raw text stream from AI SDK toTextStreamResponse
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
            ? { ...m, content: e instanceof Error ? e.message : "Failed to reach the copilot.", pending: false }
            : m
        )
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 36 }}
            className="fixed right-0 top-0 z-50 flex h-dvh w-full max-w-[440px] flex-col border-l border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-0))] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[hsl(var(--border-subtle))] px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="grid size-7 place-items-center rounded-md ai-gradient text-white">
                  <Sparkles className="size-3.5" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Goal Copilot</div>
                  <div className="text-[11px] text-[hsl(var(--fg-muted))]">Scoped to {session.role}</div>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                <X className="size-4" />
              </Button>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((m) => (
                <Bubble key={m.id} msg={m} />
              ))}
            </div>

            <div className="border-t border-[hsl(var(--border-subtle))] px-3 pt-2.5 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {QUICK_SKILLS.map((q) => {
                  const I = q.icon;
                  return (
                    <button
                      key={q.skill}
                      onClick={() => send(q.label)}
                      disabled={pending}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] px-2.5 py-1 text-xs text-[hsl(var(--fg-secondary))] hover:border-[hsl(var(--accent))] hover:text-[hsl(var(--accent))] transition-colors disabled:opacity-50"
                    >
                      <I className="size-3" />
                      {q.label}
                    </button>
                  );
                })}
              </div>
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
                  disabled={pending}
                  placeholder="Ask the copilot…"
                  className="h-11 flex-1 rounded-md border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] px-3 text-sm placeholder:text-[hsl(var(--fg-muted))] focus-ring sm:h-10"
                />
                <Button variant="ai" type="submit" disabled={pending || !input.trim()} aria-label="Send" className="px-3 sm:px-4">
                  <Send className="size-4" />
                  <span className="hidden sm:inline">Send</span>
                </Button>
              </form>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[92%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
          isUser
            ? "bg-[hsl(var(--accent))] text-white"
            : "border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] text-[hsl(var(--fg-primary))]"
        )}
      >
        {msg.content || (msg.pending && (
          <span className="inline-flex items-center gap-2 text-[hsl(var(--fg-muted))]">
            <span className="ai-shimmer h-3 w-24 rounded-full" />
          </span>
        ))}
        {msg.pending && msg.content && <span className="ml-0.5 inline-block h-3 w-2 animate-pulse bg-current" />}
      </div>
    </div>
  );
}
