import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import { PageHeader, SectionHeader } from "@/components/dashboards/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { fmtDate, fmtRelative } from "@/lib/utils";
import { Settings } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CyclesPage() {
  const session = await requireSession();
  if (session.role !== "admin") redirect("/dashboard");
  const db = getDb();
  const cycles = await db.select().from(schema.goalCycle).where(eq(schema.goalCycle.orgId, session.orgId));
  const windows = await db.select().from(schema.checkInWindow);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Cycles & windows"
        description="Configure the FY cycle and quarterly check-in windows. Edits are audit-logged."
      />

      {cycles.map((c) => {
        const cycleWindows = windows.filter((w) => w.cycleId === c.id);
        return (
          <Card key={c.id}>
            <div className="flex items-center justify-between border-b border-[hsl(var(--border-subtle))] p-5">
              <div>
                <div className="text-sm font-semibold">{c.fyLabel}</div>
                <div className="text-xs text-[hsl(var(--fg-muted))]">
                  Phase 1: {fmtDate(c.opensAt)} → {fmtDate(c.locksAt)}
                </div>
              </div>
              <Badge tone={c.status === "open" ? "success" : c.status === "locked" ? "warn" : "neutral"}>
                {c.status}
              </Badge>
            </div>
            <CardContent className="p-5">
              <SectionHeader title="Quarterly windows" description="Each window controls when employees can submit check-ins." />
              <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                {cycleWindows.map((w) => {
                  const open = Date.now() >= w.opensAt.getTime() && Date.now() <= w.closesAt.getTime();
                  return (
                    <div
                      key={w.id}
                      className="rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold">{w.period}</div>
                        <Badge tone={open ? "success" : "neutral"}>{open ? "Open" : "Closed"}</Badge>
                      </div>
                      <div className="mt-1.5 space-y-0.5 text-xs text-[hsl(var(--fg-muted))]">
                        <div>Opens · {fmtDate(w.opensAt)}</div>
                        <div>Closes · {fmtDate(w.closesAt)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardContent className="flex items-center gap-4 p-5">
          <div className="grid size-9 place-items-center rounded-md bg-[hsl(var(--surface-2))] text-[hsl(var(--fg-secondary))]">
            <Settings className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">Microsoft Graph sync</div>
            <div className="text-xs text-[hsl(var(--fg-muted))]">
              Pulls users and the manager chain from Entra ID. Off by default — set <code>GRAPH_SYNC_ENABLED=true</code> with admin consent.
            </div>
          </div>
          <Button variant="secondary" disabled>
            Sync now
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
