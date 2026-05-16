import "server-only";
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";

export type DemoIdentity = {
  id: string;
  displayName: string;
  email: string;
  role: "employee" | "manager" | "admin";
  department: string | null;
  title: string | null;
};

export async function listDemoIdentities(): Promise<DemoIdentity[]> {
  const db = getDb();
  const users = await db
    .select({
      id: schema.user.id,
      displayName: schema.user.displayName,
      email: schema.user.email,
      role: schema.user.role,
      department: schema.user.department,
      title: schema.user.title,
    })
    .from(schema.user)
    .where(eq(schema.user.isActive, true))
    .all();

  // Sort: admin first, then managers, then employees by name
  const order = { admin: 0, manager: 1, employee: 2 } as const;
  return users.sort((a, b) => order[a.role] - order[b.role] || a.displayName.localeCompare(b.displayName));
}

export async function findDemoUser(userId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.user)
    .where(and(eq(schema.user.id, userId), eq(schema.user.isActive, true)))
    .limit(1);
  return rows[0] ?? null;
}
