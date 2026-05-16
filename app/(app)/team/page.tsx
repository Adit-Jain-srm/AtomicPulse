import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { loadDashboardData } from "@/lib/db/queries";
import { PageHeader, StatCard } from "@/components/dashboards/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, Users, Target, CheckCircle2, AlertCircle } from "lucide-react";
import { SHEET_STATUS_LABELS, SHEET_STATUS_TONES } from "@/lib/domain/state-machine";
import { computeScore, weightedSheetScore } from "@/lib/domain/scoring";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await requireSession();
  if (session.role === "employee") redirect("/dashboard");

  const data = await loadDashboardData(session);
  if (!data.cycle) return <div className="p-10 text-center">No active cycle.</div>;
  if (data.role === "employee") {
    redirect("/dashboard");
  }
  // After narrow: role is "manager" | "admin"
  const reports =
    data.role === "manager"
      ? data.reports
      : data.users.filter((u) => u.role !== "admin");
  const sheets = data.role === "manager" || data.role === "admin" ? data.sheets : [];
  const goals = data.goals ?? [];

  const sheetByOwner = new Map(sheets.map((s) => [s.ownerId, s]));

  const totalReports = reports.length;
  const submitted = sheets.filter((s) => s.status !== "draft").length;
  const locked = sheets.filter((s) => s.status === "locked" || s.status === "approved").length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={data.role === "admin" ? "Org · governance" : "Manager view"}
        title={data.role === "admin" ? "All people" : "My team"}
        description="A live picture of allocation, completion, and risk across your team."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="People" value={totalReports} hint={`${reports.filter((r) => r.role === "employee").length} employees`} />
        <StatCard icon={Target} label="Sheets submitted" value={`${submitted}/${totalReports}`} />
        <StatCard icon={CheckCircle2} label="Sheets locked" value={`${locked}/${totalReports}`} />
        <StatCard icon={AlertCircle} label="Pending" value={totalReports - locked} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {reports.map((r) => {
              const sheet = sheetByOwner.get(r.id);
              const sheetGoals = sheet ? goals.filter((g) => g.sheetId === sheet.id) : [];
              const status = sheet?.status ?? "draft";
              const onTrackPct = sheetGoals.length
                ? Math.round((sheetGoals.filter((g) => g.status === "on_track" || g.status === "completed").length / sheetGoals.length) * 100)
                : 0;
              return (
                <Link
                  key={r.id}
                  href={sheet ? `/goals/${sheet.id}` : "/goals"}
                  className="group rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-0))] p-4 transition-all hover:border-[hsl(var(--border-strong))] hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={r.displayName} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{r.displayName}</div>
                      <div className="truncate text-xs text-[hsl(var(--fg-muted))]">{r.title ?? r.department ?? "—"}</div>
                    </div>
                    <Badge tone={SHEET_STATUS_TONES[status]}>{SHEET_STATUS_LABELS[status]}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <Mini label="Goals" value={sheetGoals.length} />
                    <Mini label="Weight" value={`${(sheet?.totalWeightageBp ?? 0) / 100}%`} />
                    <Mini label="Progress" value={`${onTrackPct}%`} tone={onTrackPct > 60 ? "ok" : "warn"} />
                  </div>
                  <div className="mt-3">
                    <Progress value={onTrackPct} tone={onTrackPct > 60 ? "success" : "warn"} />
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Mini({ label, value, tone = "default" }: { label: string; value: React.ReactNode; tone?: "default" | "ok" | "warn" }) {
  return (
    <div className="rounded-md bg-[hsl(var(--surface-1))] px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-[hsl(var(--fg-muted))]">{label}</div>
      <div className={
        "text-sm font-semibold tabular-nums " +
        (tone === "ok" ? "text-[hsl(var(--success))]" : tone === "warn" ? "text-[hsl(var(--warn))]" : "")
      }>
        {value}
      </div>
    </div>
  );
}
