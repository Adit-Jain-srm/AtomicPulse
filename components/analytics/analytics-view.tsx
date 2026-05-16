"use client";
import * as React from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, RadialBarChart, RadialBar, PolarAngleAxis, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from "recharts";
import type { Session } from "@/lib/auth/session";
import type { DbCheckIn, DbGoal, DbGoalCycle, DbGoalSheet, DbThrustArea, DbUser } from "@/lib/db/schema";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, SectionHeader, StatCard } from "@/components/dashboards/shared";
import { Sparkles, Target, Activity, BarChart3, Heart, Layers, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { computeScore } from "@/lib/domain/scoring";

export type ManagerEffectivenessRow = {
  managerId: string;
  managerName: string;
  totalReports: number;
  withCurrentCheckIn: number;
  pct: number;
};

/**
 * Tracks the rendered width of an element so Recharts layouts can adapt at
 * narrow breakpoints (smaller pie radii, tighter bar margins, etc.).
 */
function useContainerWidth<T extends HTMLElement = HTMLDivElement>() {
  const ref = React.useRef<T | null>(null);
  const [width, setWidth] = React.useState(0);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(e.contentRect.width);
    });
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

export function AnalyticsView({
  session,
  cycle,
  goals,
  sheets,
  checkIns,
  users,
  thrustAreas,
  managerEffectiveness,
}: {
  session: Session;
  cycle: DbGoalCycle;
  goals: DbGoal[];
  sheets: DbGoalSheet[];
  checkIns: DbCheckIn[];
  users: DbUser[];
  thrustAreas: DbThrustArea[];
  managerEffectiveness: ManagerEffectivenessRow[];
}) {
  const pieContainer = useContainerWidth<HTMLDivElement>();
  const thrustContainer = useContainerWidth<HTMLDivElement>();
  const managerContainer = useContainerWidth<HTMLDivElement>();
  // Thrust area distribution (count + weight)
  const thrustData = thrustAreas.map((t) => {
    const tg = goals.filter((g) => g.thrustAreaId === t.id);
    const totalWeight = tg.reduce((s, g) => s + g.weightageBp, 0);
    return {
      name: t.name,
      count: tg.length,
      weight: Math.round(totalWeight / 100),
      color: t.color,
    };
  }).filter((t) => t.count > 0);

  // UoM distribution
  const uomCounts = goals.reduce<Record<string, number>>((acc, g) => {
    acc[g.uomType] = (acc[g.uomType] ?? 0) + 1;
    return acc;
  }, {});
  const uomData = Object.entries(uomCounts).map(([k, v]) => ({ name: uomLabel(k), count: v }));

  // QoQ trend (avg composite score per period)
  const qoqData = ["Q1", "Q2", "Q3", "Q4"].map((p) => {
    const periodCheckIns = checkIns.filter((c) => c.period === p);
    const scored = goals.map((g) => {
      const c = periodCheckIns.find((c) => c.goalId === g.id);
      const s = computeScore({
        uomType: g.uomType,
        target: g.targetValue,
        targetDate: g.targetDate ?? null,
        actual: c?.actualValue ?? null,
        completionDate: c?.completionDate ?? null,
      });
      return { weight: g.weightageBp, score: s.bp };
    });
    const totalWeight = scored.reduce((s, x) => s + x.weight, 0);
    const weighted = totalWeight === 0 ? 0 : scored.reduce((s, x) => s + (x.score * x.weight) / totalWeight, 0) / 100;
    return { period: p, score: Math.round(weighted) };
  });

  // Heatmap: rows = users, cols = quarters, cell = composite %
  const heatmapData = users.map((u) => {
    const sheet = sheets.find((s) => s.ownerId === u.id);
    const sheetGoals = sheet ? goals.filter((g) => g.sheetId === sheet.id) : [];
    const cells = ["Q1", "Q2", "Q3", "Q4"].map((p) => {
      const periodCheckIns = checkIns.filter((c) => c.period === p && sheetGoals.some((g) => g.id === c.goalId));
      const scored = sheetGoals.map((g) => {
        const c = periodCheckIns.find((c) => c.goalId === g.id);
        const s = computeScore({
          uomType: g.uomType,
          target: g.targetValue,
          targetDate: g.targetDate ?? null,
          actual: c?.actualValue ?? null,
          completionDate: c?.completionDate ?? null,
        });
        return { weight: g.weightageBp, score: s.bp };
      });
      const tw = scored.reduce((s, x) => s + x.weight, 0);
      const v = tw === 0 ? 0 : scored.reduce((s, x) => s + (x.score * x.weight) / tw, 0) / 100;
      return Math.round(v);
    });
    return { user: u, cells };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${cycle.fyLabel} analytics`}
        title="Performance analytics"
        description="Quarter-over-quarter trends, thrust-area allocation, and team heatmap."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Target} label="Goals" value={goals.length} hint={`${sheets.length} sheets`} />
        <StatCard
          icon={Activity}
          label="Avg composite"
          value={`${qoqData.find((d) => d.score > 0)?.score ?? 0}%`}
          hint="Weighted by goal weightage"
        />
        <StatCard icon={Layers} label="Thrust areas" value={thrustData.length} hint={`of ${thrustAreas.length} active`} />
        <StatCard icon={Heart} label="Engagement" value={`${Math.round((checkIns.filter((c) => c.employeeSubmittedAt).length / Math.max(1, goals.length)) * 100)}%`} hint="Q1 check-ins submitted" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="border-b border-[hsl(var(--border-subtle))] p-5">
            <SectionHeader title="QoQ composite score" description="Weighted, across all visible goals." />
          </div>
          <CardContent className="p-5">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={qoqData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-subtle))" />
                <XAxis dataKey="period" stroke="hsl(var(--fg-muted))" fontSize={12} />
                <YAxis stroke="hsl(var(--fg-muted))" fontSize={12} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--surface-0))",
                    border: "1px solid hsl(var(--border-subtle))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Line type="monotone" dataKey="score" stroke="hsl(var(--accent))" strokeWidth={3} dot={{ fill: "hsl(var(--accent))", r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <div className="border-b border-[hsl(var(--border-subtle))] p-5">
            <SectionHeader title="Thrust area allocation" description="Total weightage across goals." />
          </div>
          <CardContent className="p-5">
            <div ref={thrustContainer.ref}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={thrustData}
                  layout="vertical"
                  margin={
                    thrustContainer.width > 0 && thrustContainer.width < 480
                      ? { top: 8, right: 8, left: 60, bottom: 8 }
                      : { top: 5, right: 30, left: 80, bottom: 5 }
                  }
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-subtle))" />
                  <XAxis type="number" stroke="hsl(var(--fg-muted))" fontSize={11} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="hsl(var(--fg-muted))"
                    fontSize={11}
                    width={thrustContainer.width > 0 && thrustContainer.width < 480 ? 80 : 120}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--surface-0))",
                      border: "1px solid hsl(var(--border-subtle))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="weight" radius={[0, 6, 6, 0]}>
                    {thrustData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between border-b border-[hsl(var(--border-subtle))] p-5">
          <SectionHeader
            title="Manager effectiveness"
            description="Share of each manager's direct reports who submitted a check-in for the most recent window."
          />
          <Badge tone="neutral">
            <Users className="size-3" /> {managerEffectiveness.length} {managerEffectiveness.length === 1 ? "manager" : "managers"}
          </Badge>
        </div>
        <CardContent className="p-5">
          {managerEffectiveness.length === 0 ? (
            <div className="py-10 text-center text-sm text-[hsl(var(--fg-muted))]">
              No managers in scope yet — once a check-in window opens and reports are assigned, manager submission rates appear here.
            </div>
          ) : (
            <div ref={managerContainer.ref}>
              <ResponsiveContainer width="100%" height={Math.max(180, managerEffectiveness.length * 36 + 40)}>
                <BarChart
                  data={managerEffectiveness}
                  layout="vertical"
                  margin={
                    managerContainer.width > 0 && managerContainer.width < 480
                      ? { top: 8, right: 8, left: 60, bottom: 8 }
                      : { top: 5, right: 30, left: 80, bottom: 5 }
                  }
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-subtle))" />
                  <XAxis type="number" stroke="hsl(var(--fg-muted))" fontSize={11} domain={[0, 100]} unit="%" />
                  <YAxis
                    type="category"
                    dataKey="managerName"
                    stroke="hsl(var(--fg-muted))"
                    fontSize={11}
                    width={managerContainer.width > 0 && managerContainer.width < 480 ? 80 : 140}
                  />
                  <Tooltip
                    formatter={(value: number, _name, item) => {
                      const row = item?.payload as ManagerEffectivenessRow | undefined;
                      if (!row) return [`${value}%`, "Submitted"];
                      return [`${value}%  (${row.withCurrentCheckIn}/${row.totalReports})`, "Submitted"];
                    }}
                    contentStyle={{
                      background: "hsl(var(--surface-0))",
                      border: "1px solid hsl(var(--border-subtle))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="pct" fill="hsl(var(--accent))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <div className="border-b border-[hsl(var(--border-subtle))] p-5">
          <SectionHeader
            title="Performance heatmap"
            description="Composite weighted score per person, per quarter. Darker = lower."
          />
        </div>
        <CardContent className="p-5">
          {heatmapData.length === 0 ? (
            <div className="py-10 text-center text-sm text-[hsl(var(--fg-muted))]">
              No team data yet — sheets need to be approved and check-ins submitted to populate the heatmap.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-2 py-2 text-left font-medium text-[hsl(var(--fg-muted))]">Person</th>
                    {["Q1", "Q2", "Q3", "Q4"].map((p) => (
                      <th key={p} className="px-2 py-2 text-center font-medium text-[hsl(var(--fg-muted))]">{p}</th>
                    ))}
                    <th className="px-2 py-2 text-right font-medium text-[hsl(var(--fg-muted))]">Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {heatmapData.map(({ user, cells }) => {
                    const avg = cells.filter((v) => v > 0).length === 0 ? 0 : Math.round(cells.filter((v) => v > 0).reduce((s, v) => s + v, 0) / cells.filter((v) => v > 0).length);
                    return (
                      <tr key={user.id} className="border-t border-[hsl(var(--border-subtle))]">
                        <td className="px-2 py-2 font-medium">{user.displayName}</td>
                        {cells.map((v, i) => (
                          <td key={i} className="px-1.5 py-1.5 text-center">
                            <HeatCell value={v} />
                          </td>
                        ))}
                        <td className="px-2 py-2 text-right font-mono tabular-nums">{avg}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <div className="flex items-center justify-between border-b border-[hsl(var(--border-subtle))] p-5">
          <SectionHeader title="UoM mix" description="Distribution of unit-of-measure types in active goals." />
          <Badge tone="ai">
            <Sparkles className="size-3" /> AI suggests adding more &ldquo;max&rdquo; goals
          </Badge>
        </div>
        <CardContent className="p-5">
          <div ref={pieContainer.ref}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={uomData}
                  dataKey="count"
                  nameKey="name"
                  innerRadius={pieContainer.width > 0 && pieContainer.width < 360 ? 36 : 50}
                  outerRadius={pieContainer.width > 0 && pieContainer.width < 360 ? 64 : 90}
                >
                  {uomData.map((_, i) => (
                    <Cell key={i} fill={["#2563EB", "#10B981", "#F59E0B", "#A855F7", "#EC4899", "#14B8A6"][i % 6]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--surface-0))",
                    border: "1px solid hsl(var(--border-subtle))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HeatCell({ value }: { value: number }) {
  if (value === 0) {
    return <div className="mx-auto size-7 rounded bg-[hsl(var(--surface-2))]" />;
  }
  // green scale 0-100
  const intensity = value / 100;
  const bg = `hsl(142 71% ${85 - intensity * 35}%)`;
  const fg = intensity > 0.5 ? "white" : "hsl(var(--fg-primary))";
  return (
    <div
      className="mx-auto grid size-7 place-items-center rounded text-[10px] font-semibold tabular-nums"
      style={{ backgroundColor: bg, color: fg }}
    >
      {value}
    </div>
  );
}

function uomLabel(t: string) {
  switch (t) {
    case "min_num": return "Min #";
    case "min_pct": return "Min %";
    case "max_num": return "Max #";
    case "max_pct": return "Max %";
    case "timeline": return "Timeline";
    case "zero": return "Zero";
    default: return t;
  }
}
