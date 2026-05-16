import "server-only";
import { eq } from "drizzle-orm";
import type { Session } from "@/lib/auth/session";
import { matrix, type Action, type Scope } from "./matrix";
import { getDb, schema } from "@/lib/db/client";

export type ResourceRef = {
  orgId?: string;
  ownerId?: string;
  managerId?: string;
};

export class ForbiddenError extends Error {
  code = "forbidden" as const;
  constructor(message = "Forbidden") {
    super(message);
  }
}

function isReportOf(reportId: string | null | undefined, managerId: string): boolean {
  return !!reportId && reportId === managerId;
}

async function loadDirectReportIds(managerId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.managerId, managerId));
  return rows.map((r) => r.id);
}

export async function checkPermission(
  session: Session | null,
  action: Action,
  ref: ResourceRef = {}
): Promise<{ allowed: boolean; reason?: string }> {
  if (!session) return { allowed: false, reason: "unauthenticated" };
  const scope: Scope = matrix[action][session.role];
  if (scope === "deny") return { allowed: false, reason: "role_denied" };

  if (scope === "org") {
    if (ref.orgId && ref.orgId !== session.orgId) {
      return { allowed: false, reason: "wrong_org" };
    }
    return { allowed: true };
  }

  if (scope === "self") {
    if (!ref.ownerId) return { allowed: true }; // creating-own resources
    if (ref.ownerId !== session.userId) return { allowed: false, reason: "not_owner" };
    return { allowed: true };
  }

  if (scope === "report") {
    if (!ref.ownerId) return { allowed: true };
    if (ref.ownerId === session.userId) return { allowed: true }; // managers also have self-scope
    // direct report check
    const reports = await loadDirectReportIds(session.userId);
    if (reports.includes(ref.ownerId)) return { allowed: true };
    if (ref.managerId && isReportOf(ref.managerId, session.userId)) return { allowed: true };
    return { allowed: false, reason: "not_direct_report" };
  }

  return { allowed: false, reason: "unknown_scope" };
}

export async function requirePermission(
  session: Session | null,
  action: Action,
  ref: ResourceRef = {}
): Promise<Session> {
  const res = await checkPermission(session, action, ref);
  if (!res.allowed || !session) {
    throw new ForbiddenError(`Permission denied for ${action}: ${res.reason ?? "no_session"}`);
  }
  return session;
}
