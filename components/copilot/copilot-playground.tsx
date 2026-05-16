"use client";
import * as React from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Sparkles, Wand2, Lightbulb, ListChecks, Activity, Users, Zap, Search, Send, FileSearch } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SkillNames, type SkillName } from "@/lib/ai/skills";
import type { Session } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

type SkillSpec = {
  id: SkillName;
  label: string;
  description: string;
  icon: any;
  defaultInput: any;
  fields: { key: string; label: string; type: "text" | "textarea" | "select"; options?: string[] }[];
};

const SKILLS: SkillSpec[] = [
  {
    id: "generateSmartGoal",
    label: "Generate SMART goal",
    description: "Draft a single, well-formed SMART goal you can drop into your sheet.",
    icon: Wand2,
    defaultInput: { role: "Engineer", department: "Engineering" },
    fields: [
      { key: "role", label: "Role", type: "text" },
      { key: "department", label: "Department", type: "text" },
      { key: "hint", label: "Hint (optional)", type: "textarea" },
    ],
  },
  {
    id: "improveGoalClarity",
    label: "Improve goal clarity",
    description: "Rewrite a goal to be more specific and measurable.",
    icon: Lightbulb,
    defaultInput: { title: "Improve customer satisfaction" },
    fields: [
      { key: "title", label: "Goal title", type: "text" },
      { key: "description", label: "Description (optional)", type: "textarea" },
    ],
  },
  {
    id: "suggestKpi",
    label: "Suggest KPIs",
    description: "Three KPIs paired with this thrust area.",
    icon: ListChecks,
    defaultInput: { thrustAreaName: "Customer Outcomes", role: "Manager" },
    fields: [
      { key: "thrustAreaName", label: "Thrust area", type: "text" },
      { key: "role", label: "Role", type: "text" },
    ],
  },
  {
    id: "summarizeQuarter",
    label: "Summarise quarter",
    description: "AI summary of your quarter's progress.",
    icon: Activity,
    defaultInput: { period: "Q1" },
    fields: [{ key: "period", label: "Period", type: "select", options: ["Q1", "Q2", "Q3", "Q4"] }],
  },
  {
    id: "predictCompletionRisk",
    label: "Predict risk",
    description: "Risk score and signals for a single goal.",
    icon: Zap,
    defaultInput: { goalTitle: "Ship new analytics engine", status: "on_track" },
    fields: [
      { key: "goalTitle", label: "Goal title", type: "text" },
      { key: "status", label: "Status", type: "select", options: ["not_started", "on_track", "completed"] },
    ],
  },
  {
    id: "managerCopilot",
    label: "Manager 1:1 brief",
    description: "Talking points and questions for your next 1:1.",
    icon: Users,
    defaultInput: { reportName: "Alex Rivera" },
    fields: [{ key: "reportName", label: "Report name", type: "text" }],
  },
  {
    id: "goalAlignmentCheck",
    label: "Alignment check",
    description: "Does the sheet cover the org's strategic priorities?",
    icon: Sparkles,
    defaultInput: { titles: ["Lift NPS", "Cut latency", "Ship Goal Copilot"] },
    fields: [{ key: "titles", label: "Goal titles (comma-separated)", type: "textarea" }],
  },
  {
    id: "semanticSearch",
    label: "Semantic search",
    description: "Search across goals you have access to.",
    icon: FileSearch,
    defaultInput: { query: "renewal NPS" },
    fields: [{ key: "query", label: "Query", type: "text" }],
  },
];

export function CopilotPlayground({
  session,
  initialSkill,
  initialQuery,
}: {
  session: Session;
  initialSkill?: string;
  initialQuery?: string;
}) {
  const [activeId, setActiveId] = React.useState<SkillName>(
    (SKILLS.find((s) => s.id === initialSkill)?.id ?? "generateSmartGoal") as SkillName
  );
  const active = SKILLS.find((s) => s.id === activeId)!;
  const [input, setInput] = React.useState<any>(() => ({ ...active.defaultInput, ...(initialQuery ? { query: initialQuery } : {}) }));
  const [output, setOutput] = React.useState<any>(null);
  const [running, setRunning] = React.useState(false);

  React.useEffect(() => {
    setInput({ ...active.defaultInput });
    setOutput(null);
  }, [active.id]);

  async function run() {
    setRunning(true);
    setOutput(null);
    try {
      // Special-case array fields
      const finalInput = { ...input };
      if (active.id === "goalAlignmentCheck" && typeof finalInput.titles === "string") {
        finalInput.titles = finalInput.titles.split(",").map((s: string) => s.trim()).filter(Boolean);
      }
      const res = await fetch("/api/copilot/skill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill: active.id, input: finalInput }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error?.message ?? "AI failed");
      setOutput(j.data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card>
        <CardContent className="p-2">
          <ul className="flex flex-col gap-0.5">
            {SKILLS.map((s) => {
              const I = s.icon;
              const active = s.id === activeId;
              return (
                <li key={s.id}>
                  <button
                    onClick={() => setActiveId(s.id)}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
                      active
                        ? "bg-[hsl(var(--accent-soft))] text-[hsl(var(--accent))]"
                        : "hover:bg-[hsl(var(--surface-1))] text-[hsl(var(--fg-secondary))]"
                    )}
                  >
                    <I className="mt-0.5 size-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{s.label}</div>
                      <div className="text-[11px] text-[hsl(var(--fg-muted))]">{s.description}</div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <div className="flex items-center justify-between border-b border-[hsl(var(--border-subtle))] p-5">
            <div>
              <div className="flex items-center gap-2">
                <div className="grid size-7 place-items-center rounded-md ai-gradient text-white">
                  <Sparkles className="size-3.5" />
                </div>
                <div className="text-sm font-semibold">{active.label}</div>
              </div>
              <div className="mt-0.5 text-xs text-[hsl(var(--fg-muted))]">{active.description}</div>
            </div>
            <Badge tone="ai">{process.env.NEXT_PUBLIC_AI_MODE_HINT ?? "stub mode"}</Badge>
          </div>
          <CardContent className="space-y-3 p-5">
            {active.fields.map((f) => (
              <div key={f.key} className="space-y-1">
                <label className="text-xs font-medium text-[hsl(var(--fg-secondary))]">{f.label}</label>
                {f.type === "textarea" ? (
                  <Textarea
                    rows={2}
                    value={(input[f.key] ?? "") as string}
                    onChange={(e) => setInput((p: any) => ({ ...p, [f.key]: e.target.value }))}
                  />
                ) : f.type === "select" ? (
                  <select
                    className="h-9 w-full rounded-md border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-0))] px-2 text-sm focus-ring"
                    value={(input[f.key] ?? "") as string}
                    onChange={(e) => setInput((p: any) => ({ ...p, [f.key]: e.target.value }))}
                  >
                    {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <Input
                    value={(input[f.key] ?? "") as string}
                    onChange={(e) => setInput((p: any) => ({ ...p, [f.key]: e.target.value }))}
                  />
                )}
              </div>
            ))}
            <Button variant="ai" size="lg" onClick={run} disabled={running}>
              <Sparkles className="size-4" />
              {running ? "Running…" : "Run skill"}
              <Send className="size-3.5" />
            </Button>
          </CardContent>
        </Card>

        <Card>
          <div className="flex items-center justify-between border-b border-[hsl(var(--border-subtle))] p-5">
            <div className="text-sm font-semibold">Output</div>
            <Badge tone={output ? "success" : "neutral"}>
              {output ? "Validated" : "Awaiting run"}
            </Badge>
          </div>
          <CardContent className="p-5">
            {!output && !running && (
              <div className="rounded-md border border-dashed border-[hsl(var(--border-subtle))] p-8 text-center text-sm text-[hsl(var(--fg-muted))]">
                Run the skill to see structured output.
              </div>
            )}
            {running && (
              <div className="space-y-2">
                <div className="ai-shimmer h-3 w-2/3 rounded-full" />
                <div className="ai-shimmer h-3 w-1/2 rounded-full" />
                <div className="ai-shimmer h-3 w-3/4 rounded-full" />
              </div>
            )}
            {output && (
              <motion.pre
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="overflow-x-auto rounded-md bg-[hsl(var(--surface-1))] p-4 text-xs leading-relaxed"
              >
                <code>{JSON.stringify(output, null, 2)}</code>
              </motion.pre>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
