import { redirect, notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db/client";
import { eq, asc } from "drizzle-orm";
import { getSheetWithGoals, getThrustAreas, getUserById } from "@/lib/db/queries";
import { GoalSheetWorkspace } from "@/components/goals/goal-sheet-workspace";
import { checkPermission } from "@/lib/rbac/guards";

export const dynamic = "force-dynamic";

export default async function GoalSheetPage({ params }: { params: Promise<{ sheetId: string }> }) {
  const { sheetId } = await params;
  const session = await requireSession();
  const data = await getSheetWithGoals(sheetId);
  if (!data) notFound();

  const can = await checkPermission(session, "goalSheet.read", { ownerId: data.sheet.ownerId, orgId: session.orgId });
  if (!can.allowed) redirect("/dashboard");

  const owner = await getUserById(data.sheet.ownerId);
  const manager = data.sheet.managerId ? await getUserById(data.sheet.managerId) : null;
  const thrustAreas = await getThrustAreas(session.orgId);

  // Approval events for the audit drawer
  const db = getDb();
  const approvalEvents = await db
    .select()
    .from(schema.approvalEvent)
    .where(eq(schema.approvalEvent.sheetId, data.sheet.id))
    .orderBy(asc(schema.approvalEvent.occurredAt));

  return (
    <GoalSheetWorkspace
      session={session}
      sheet={data.sheet}
      goals={data.goals}
      owner={owner}
      manager={manager}
      thrustAreas={thrustAreas}
      approvalEvents={approvalEvents}
    />
  );
}
