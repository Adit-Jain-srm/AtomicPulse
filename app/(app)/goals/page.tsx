import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { loadDashboardData, getOrCreateSheetForUser, listGoalsForSheets } from "@/lib/db/queries";
import { PageHeader } from "@/components/dashboards/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Target } from "lucide-react";
import { SHEET_STATUS_LABELS, SHEET_STATUS_TONES } from "@/lib/domain/state-machine";
import { fmtRelative } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const session = await requireSession();
  const data = await loadDashboardData(session);

  if (!data.cycle) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <Target className="mx-auto size-10 text-[hsl(var(--fg-muted))]" />
          <div className="mt-4 text-base font-semibold">No active cycle</div>
          <div className="mt-1 text-sm text-[hsl(var(--fg-muted))]">
            An admin needs to open a goal cycle.
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.role === "employee") {
    const sheet = await getOrCreateSheetForUser({
      cycleId: data.cycle.id, ownerId: session.userId, managerId: session.managerId,
    });
    const goals = await listGoalsForSheets([sheet.id]);
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={`${data.cycle.fyLabel} cycle`}
          title="My goals"
          description="Build, weight, and submit your goal sheet. Total weightage must equal 100%."
          actions={
            <Button variant="ai" asChild>
              <Link href={`/goals/${sheet.id}`}>
                <Sparkles className="size-4" /> Open editor
              </Link>
            </Button>
          }
        />
        <Card>
          <CardContent className="p-0">
            <SheetRow
              title={`${session.displayName} · ${data.cycle.fyLabel}`}
              subtitle={`${goals.length} goals · ${(sheet.totalWeightageBp / 100).toFixed(0)}% allocated`}
              status={sheet.status}
              href={`/goals/${sheet.id}`}
              when={sheet.submittedAt ?? sheet.updatedAt}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Manager / Admin — list of sheets
  const isAdmin = data.role === "admin";
  const sheets = data.sheets;
  const owners = (isAdmin ? data.users : data.reports);
  const ownerById = new Map(owners.map((u) => [u.id, u]));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${data.cycle.fyLabel} cycle`}
        title={isAdmin ? "All goal sheets" : "Team goal sheets"}
        description={isAdmin ? "Org-wide visibility. Filter, review, or unlock as needed." : "Approve, return, or open for inline review."}
        actions={
          <Button variant="secondary" asChild>
            <Link href="/api/exports/achievement.csv">Export CSV</Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {sheets.length === 0 ? (
            <div className="p-10 text-center text-sm text-[hsl(var(--fg-muted))]">
              No sheets yet for this cycle.
            </div>
          ) : (
            <ul className="divide-y divide-[hsl(var(--border-subtle))]">
              {sheets
                .sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0))
                .map((s) => {
                  const owner = ownerById.get(s.ownerId);
                  const goalCount = data.goals.filter((g) => g.sheetId === s.id).length;
                  return (
                    <SheetRow
                      key={s.id}
                      title={owner?.displayName ?? "—"}
                      subtitle={`${owner?.title ?? owner?.department ?? "—"} · ${goalCount} goals · ${(s.totalWeightageBp / 100).toFixed(0)}%`}
                      status={s.status}
                      href={`/goals/${s.id}`}
                      avatarName={owner?.displayName}
                      when={s.submittedAt ?? s.updatedAt}
                    />
                  );
                })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SheetRow({
  title,
  subtitle,
  status,
  href,
  avatarName,
  when,
}: {
  title: string;
  subtitle: string;
  status: keyof typeof SHEET_STATUS_LABELS;
  href: string;
  avatarName?: string;
  when?: Date | null;
}) {
  return (
    <li className="px-5">
      <Link href={href} className="flex items-center gap-4 py-3.5 -mx-5 px-5 transition-colors hover:bg-[hsl(var(--surface-1))]">
        {avatarName ? <Avatar name={avatarName} size={36} /> : <div className="grid size-9 place-items-center rounded-md bg-[hsl(var(--surface-2))]"><Target className="size-4 text-[hsl(var(--fg-muted))]"/></div>}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{title}</div>
          <div className="text-xs text-[hsl(var(--fg-muted))]">{subtitle}</div>
        </div>
        {when && <div className="text-xs text-[hsl(var(--fg-muted))]">{fmtRelative(when)}</div>}
        <Badge tone={SHEET_STATUS_TONES[status]}>{SHEET_STATUS_LABELS[status]}</Badge>
        <ArrowRight className="size-4 text-[hsl(var(--fg-muted))]" />
      </Link>
    </li>
  );
}
