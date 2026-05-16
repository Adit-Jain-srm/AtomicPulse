import { redirect, notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { checkPermission } from "@/lib/rbac/guards";
import { getActiveCycle, getCheckInWindows, listGoalsForSheets, getCheckInsForGoals, getUserById } from "@/lib/db/queries";
import { getDb, schema } from "@/lib/db/client";
import { and, eq } from "drizzle-orm";
import { CheckInsClient } from "@/components/check-ins/check-ins-client";
import { PageHeader } from "@/components/dashboards/shared";
import { isWindowOpen, periodLabel } from "@/lib/domain/windows";
import { Avatar } from "@/components/ui/avatar";

export const dynamic = "force-dynamic";

export default async function ManagerCheckInPage({ params }: { params: Promise<{ ownerId: string }> }) {
  const { ownerId } = await params;
  const session = await requireSession();
  const owner = await getUserById(ownerId);
  if (!owner) notFound();

  const can = await checkPermission(session, "checkIn.manager.acknowledge", { ownerId, orgId: session.orgId });
  if (!can.allowed) redirect("/check-ins");

  const cycle = await getActiveCycle(session.orgId);
  if (!cycle) return <div className="p-10 text-center">No active cycle.</div>;

  const db = getDb();
  const sheet = (await db.select().from(schema.goalSheet).where(and(eq(schema.goalSheet.cycleId, cycle.id), eq(schema.goalSheet.ownerId, ownerId))).limit(1))[0];
  if (!sheet) return <div className="p-10 text-center">No sheet for this cycle.</div>;
  const goals = await listGoalsForSheets([sheet.id]);
  const checkIns = await getCheckInsForGoals(goals.map((g) => g.id));
  const windows = await getCheckInWindows(cycle.id);
  const openWindow = windows.find((w) => isWindowOpen({ opensAt: w.opensAt, closesAt: w.closesAt }));
  const openPeriod = openWindow?.period ?? "Q1";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${cycle.fyLabel} · ${periodLabel(openPeriod)}`}
        title={owner.displayName}
        description={`${owner.title ?? owner.department ?? ""} — review the quarterly entries and acknowledge with a structured comment.`}
      />
      <CheckInsClient
        session={session}
        period={openPeriod}
        windows={windows}
        goals={goals}
        sheet={sheet}
        checkIns={checkIns}
        owner={owner}
        mode="manager"
      />
    </div>
  );
}
