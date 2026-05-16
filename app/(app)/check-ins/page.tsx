import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { loadDashboardData } from "@/lib/db/queries";
import { PageHeader, SectionHeader } from "@/components/dashboards/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CheckInsClient } from "@/components/check-ins/check-ins-client";
import { ALL_PERIODS, periodLabel, isWindowOpen } from "@/lib/domain/windows";
import { CalendarCheck2 } from "lucide-react";
import { getCheckInWindows, getUserById } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function CheckInsPage() {
  const session = await requireSession();
  const data = await loadDashboardData(session);
  if (!data.cycle) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <CalendarCheck2 className="mx-auto size-10 text-[hsl(var(--fg-muted))]" />
          <div className="mt-4 text-base font-semibold">No active cycle</div>
        </CardContent>
      </Card>
    );
  }

  const windows = await getCheckInWindows(data.cycle.id);
  const now = new Date();
  const openWindow = windows.find((w) => isWindowOpen({ opensAt: w.opensAt, closesAt: w.closesAt }, now));
  const openPeriod = openWindow?.period ?? "Q1";

  if (data.role === "employee") {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={`${data.cycle.fyLabel} cycle`}
          title="Quarterly check-ins"
          description={openWindow ? `Window open: ${periodLabel(openPeriod)}` : "All quarterly windows are closed."}
        />
        <CheckInsClient
          session={session}
          period={openPeriod}
          windows={windows}
          goals={data.goals}
          sheet={data.sheet}
          checkIns={data.checkIns}
          owner={null}
          mode="self"
        />
      </div>
    );
  }

  // Manager / Admin → list reports + their pending check-ins
  const owners = data.role === "manager" ? data.reports : data.users.filter((u) => u.role !== "admin");
  const sheetByOwner = new Map(data.sheets.map((s) => [s.ownerId, s]));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${data.cycle.fyLabel} cycle`}
        title={data.role === "manager" ? "Team check-ins" : "Org check-ins"}
        description={openWindow ? `Window open: ${periodLabel(openPeriod)}` : "All windows closed."}
      />

      <Card>
        <div className="border-b border-[hsl(var(--border-subtle))] p-5">
          <SectionHeader title="People" description="Click to review and acknowledge their quarterly entries." />
        </div>
        <CardContent className="p-0">
          <ul className="divide-y divide-[hsl(var(--border-subtle))]">
            {owners.map((u) => {
              const sheet = sheetByOwner.get(u.id);
              const sheetGoals = data.goals.filter((g) => sheet && g.sheetId === sheet.id);
              const periodCheckIns = data.checkIns.filter(
                (c) => c.period === openPeriod && sheetGoals.some((g) => g.id === c.goalId)
              );
              const submitted = periodCheckIns.filter((c) => c.employeeSubmittedAt).length;
              const acked = periodCheckIns.filter((c) => c.managerAcknowledgedAt).length;
              const pct = sheetGoals.length ? Math.round((submitted / sheetGoals.length) * 100) : 0;
              return (
                <li key={u.id} className="px-5">
                  <Link
                    href={`/check-ins/${u.id}`}
                    className="flex items-center gap-4 -mx-5 px-5 py-3.5 transition-colors hover:bg-[hsl(var(--surface-1))]"
                  >
                    <Avatar name={u.displayName} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{u.displayName}</div>
                      <div className="text-xs text-[hsl(var(--fg-muted))]">
                        {u.title ?? u.department ?? "—"} · {sheetGoals.length} goals
                      </div>
                    </div>
                    <div className="text-xs tabular-nums text-[hsl(var(--fg-muted))]">{submitted}/{sheetGoals.length} submitted · {acked} acked</div>
                    <Badge tone={pct === 100 ? "success" : pct > 0 ? "info" : "neutral"}>
                      {pct}%
                    </Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
