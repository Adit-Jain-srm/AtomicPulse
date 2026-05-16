import * as React from "react";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getEscalationRules, getEscalationEvents, getOrgUsers } from "@/lib/db/queries";
import { PageHeader } from "@/components/dashboards/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ShieldAlert, Activity, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function EscalationsPage() {
  const session = await requireSession();
  if (session.role !== "admin") redirect("/dashboard");

  const rules = await getEscalationRules(session.orgId);
  const events = await getEscalationEvents(session.orgId);
  const users = await getOrgUsers(session.orgId);
  const userMap = new Map(users.map((u) => [u.id, u]));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin · governance"
        title="Escalations"
        description="Rule-based reminders and escalations for missed actions. Backed by Vercel Workflow DevKit (queued in demo mode)."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="border-b border-[hsl(var(--border-subtle))] p-5">
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-[hsl(var(--accent))]" />
              <div className="text-sm font-semibold">Rules</div>
            </div>
            <div className="mt-0.5 text-xs text-[hsl(var(--fg-muted))]">{rules.length} configured</div>
          </div>
          <CardContent className="p-0">
            <ul className="divide-y divide-[hsl(var(--border-subtle))]">
              {rules.map((r) => {
                const chain = JSON.parse(r.chainJson) as { to: string; afterDays: number }[];
                return (
                  <li key={r.id} className="px-5 py-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium">{r.name}</div>
                        <div className="text-xs text-[hsl(var(--fg-muted))]">
                          Trigger: <span className="font-mono">{r.trigger}</span> after {r.thresholdDays}d
                        </div>
                      </div>
                      <Badge tone={r.isActive ? "success" : "neutral"}>
                        {r.isActive ? "Active" : "Off"}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[hsl(var(--fg-secondary))]">
                      {chain.map((c, i) => (
                        <React.Fragment key={i}>
                          {i > 0 && <span className="text-[hsl(var(--fg-muted))]">→</span>}
                          <span className="rounded-md bg-[hsl(var(--surface-2))] px-2 py-0.5">
                            {c.to} (+{c.afterDays}d)
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <div className="border-b border-[hsl(var(--border-subtle))] p-5">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-[hsl(var(--accent))]" />
              <div className="text-sm font-semibold">Active escalations</div>
            </div>
            <div className="mt-0.5 text-xs text-[hsl(var(--fg-muted))]">{events.filter((e) => e.status === "open" || e.status === "notified").length} open</div>
          </div>
          <CardContent className="p-0">
            {events.length === 0 ? (
              <div className="p-10 text-center">
                <Clock className="mx-auto size-9 text-[hsl(var(--fg-muted))]" />
                <div className="mt-3 text-sm font-medium">All clear</div>
                <div className="mt-1 text-xs text-[hsl(var(--fg-muted))]">No active escalations.</div>
              </div>
            ) : (
              <ul className="divide-y divide-[hsl(var(--border-subtle))]">
                {events.map((e) => {
                  const u = userMap.get(e.targetUserId);
                  return (
                    <li key={e.id} className="flex items-center gap-3 px-5 py-3">
                      {u && <Avatar name={u.displayName} size={32} />}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{u?.displayName ?? "—"}</div>
                        <div className="text-xs text-[hsl(var(--fg-muted))]">{e.entityRef}</div>
                      </div>
                      <Badge tone={e.status === "resolved" ? "success" : "warn"}>{e.status}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
