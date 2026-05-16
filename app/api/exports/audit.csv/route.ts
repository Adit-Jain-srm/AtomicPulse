import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getAuditTrail, getOrgUsers } from "@/lib/db/queries";

export async function GET() {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (session.role !== "admin") return new NextResponse("Forbidden", { status: 403 });

  const events = await getAuditTrail(session.orgId, 5000);
  const users = await getOrgUsers(session.orgId);
  const userMap = new Map(users.map((u) => [u.id, u]));

  const headers = ["occurred_at", "actor", "actor_email", "action", "entity_type", "entity_id", "before", "after"];
  const esc = (v: any) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const out = [headers.join(",")];
  for (const e of events) {
    const u = e.actorId ? userMap.get(e.actorId) : null;
    out.push(
      [
        e.occurredAt.toISOString(),
        u?.displayName ?? "",
        u?.email ?? "",
        e.action,
        e.entityType,
        e.entityId,
        e.beforeJson ?? "",
        e.afterJson ?? "",
      ]
        .map(esc)
        .join(","),
    );
  }
  return new NextResponse(out.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="atomic-pulse-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
