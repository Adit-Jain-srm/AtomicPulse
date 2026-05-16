import "server-only";
import { v4 as uuid } from "uuid";
import { getDb, schema } from "@/lib/db/client";

export type AuditEntityType = (typeof schema.auditEvent.$inferInsert)["entityType"];

export async function recordAudit(input: {
  orgId: string;
  entityType: AuditEntityType;
  entityId: string;
  actorId: string | null;
  action: string;
  before?: unknown;
  after?: unknown;
}) {
  const db = getDb();
  await db.insert(schema.auditEvent).values({
    id: uuid(),
    orgId: input.orgId,
    entityType: input.entityType,
    entityId: input.entityId,
    actorId: input.actorId,
    action: input.action,
    beforeJson: input.before == null ? null : JSON.stringify(input.before),
    afterJson: input.after == null ? null : JSON.stringify(input.after),
  });
}

export function diff<T extends Record<string, unknown>>(before: T, after: T): Partial<T> {
  const out: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const k of keys) {
    if (before?.[k] !== after?.[k]) out[k] = { before: before?.[k], after: after?.[k] };
  }
  return out as Partial<T>;
}
