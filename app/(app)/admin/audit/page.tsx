import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getAuditTrail, getOrgUsers } from "@/lib/db/queries";
import { PageHeader } from "@/components/dashboards/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { fmtRelative } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const session = await requireSession();
  if (session.role !== "admin") redirect("/dashboard");

  const events = await getAuditTrail(session.orgId, 250);
  const users = await getOrgUsers(session.orgId);
  const userMap = new Map(users.map((u) => [u.id, u]));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin · audit"
        title="Audit trail"
        description="Insert-only log of every state-changing action. Sorted newest first."
        actions={
          <Button variant="secondary" asChild>
            <Link href="/api/exports/audit.csv">Export CSV</Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-[hsl(var(--border-subtle))]">
            {events.length === 0 && (
              <li className="p-10 text-center text-sm text-[hsl(var(--fg-muted))]">No events yet.</li>
            )}
            {events.map((e) => {
              const actor = e.actorId ? userMap.get(e.actorId) : null;
              return (
                <li
                  key={e.id}
                  className="flex flex-col gap-2 px-5 py-3 md:flex-row md:items-center md:gap-4"
                >
                  <Badge tone={toneFor(e.action)} className="self-start md:self-auto">
                    {e.action}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">
                      <span className="font-medium">{actor?.displayName ?? "—"}</span>
                      <span className="text-[hsl(var(--fg-muted))]"> on </span>
                      <span className="font-mono text-xs">{e.entityType}</span>
                      <span className="text-[hsl(var(--fg-muted))]"> · </span>
                      <span className="font-mono text-xs text-[hsl(var(--fg-muted))]">{e.entityId.slice(0, 8)}</span>
                    </div>
                    {(e.beforeJson || e.afterJson) && (
                      <details className="mt-1">
                        <summary className="flex min-h-11 cursor-pointer items-center text-xs uppercase tracking-wider text-[hsl(var(--fg-muted))] sm:text-[10px]">
                          diff
                        </summary>
                        <pre className="mt-1 overflow-x-auto rounded bg-[hsl(var(--surface-1))] p-2 text-[10px] leading-relaxed">
{e.beforeJson ? `BEFORE: ${e.beforeJson}\n` : ""}{e.afterJson ? `AFTER:  ${e.afterJson}` : ""}
                        </pre>
                      </details>
                    )}
                  </div>
                  <div className="text-xs text-[hsl(var(--fg-muted))] md:whitespace-nowrap">
                    {fmtRelative(e.occurredAt)}
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function toneFor(action: string): "neutral" | "info" | "success" | "warn" | "danger" {
  if (action.startsWith("delete")) return "danger";
  if (action.startsWith("approve") || action === "checkin_ack") return "success";
  if (action.startsWith("return") || action.startsWith("unlock")) return "warn";
  if (action.startsWith("submit") || action.startsWith("create")) return "info";
  return "neutral";
}
