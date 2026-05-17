import "server-only";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { acquireGraphToken, isEntraConfigured } from "@/lib/auth/msal-adapter";

export function isGraphSyncEnabled() {
  return (
    process.env.GRAPH_SYNC_ENABLED === "true" &&
    isEntraConfigured()
  );
}

type GraphUser = {
  id: string;
  displayName: string;
  mail?: string;
  userPrincipalName: string;
  department?: string;
  jobTitle?: string;
  manager?: { id: string } | null;
};

/**
 * Sync org hierarchy from Microsoft Graph.
 * Fetches all users, their managers, and department info.
 * Maps AD group membership to roles:
 *   - Members of group matching GRAPH_ADMIN_GROUP_ID → admin
 *   - Users with direct reports → manager
 *   - Everyone else → employee
 */
export async function syncOrgFromGraph(orgId: string): Promise<{ synced: number; warnings: string[] }> {
  if (!isGraphSyncEnabled()) {
    return {
      synced: 0,
      warnings: [
        "Graph sync disabled. Set GRAPH_SYNC_ENABLED=true and provide AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET to enable.",
      ],
    };
  }

  const warnings: string[] = [];
  let synced = 0;

  try {
    const token = await acquireGraphToken();
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    // Page through all users
    const users: GraphUser[] = [];
    let nextLink: string | null = "https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName,department,jobTitle&$top=100";

    while (nextLink) {
      const res: Response = await fetch(nextLink, { headers });
      if (!res.ok) {
        warnings.push(`Graph API error: ${res.status} ${res.statusText}`);
        break;
      }
      const data: { value?: GraphUser[]; "@odata.nextLink"?: string } = await res.json();
      users.push(...(data.value ?? []));
      nextLink = data["@odata.nextLink"] ?? null;
    }

    // Fetch manager for each user
    const managerMap = new Map<string, string>();
    for (const u of users) {
      try {
        const mgrRes = await fetch(`https://graph.microsoft.com/v1.0/users/${u.id}/manager?$select=id`, { headers });
        if (mgrRes.ok) {
          const mgrData = await mgrRes.json();
          if (mgrData.id) managerMap.set(u.id, mgrData.id);
        }
      } catch {
        // Some users have no manager (top-level)
      }
    }

    // Determine who has direct reports (→ manager role)
    const hasDirectReports = new Set(managerMap.values());

    // Check admin group membership if configured
    const adminGroupId = process.env.GRAPH_ADMIN_GROUP_ID;
    const adminOids = new Set<string>();
    if (adminGroupId) {
      try {
        const groupRes = await fetch(
          `https://graph.microsoft.com/v1.0/groups/${adminGroupId}/members?$select=id&$top=999`,
          { headers }
        );
        if (groupRes.ok) {
          const groupData = await groupRes.json();
          for (const m of groupData.value ?? []) {
            adminOids.add(m.id);
          }
        }
      } catch {
        warnings.push("Failed to fetch admin group membership.");
      }
    }

    // Upsert users
    const db = getDb();
    for (const u of users) {
      const email = u.mail ?? u.userPrincipalName;
      if (!email) continue;

      let role: "employee" | "manager" | "admin" = "employee";
      if (adminOids.has(u.id)) role = "admin";
      else if (hasDirectReports.has(u.id)) role = "manager";

      const existing = (await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.entraOid, u.id))
        .limit(1))[0];

      const mgrOid = managerMap.get(u.id);
      let managerId: string | null = null;
      if (mgrOid) {
        const mgr = (await db
          .select()
          .from(schema.user)
          .where(eq(schema.user.entraOid, mgrOid))
          .limit(1))[0];
        managerId = mgr?.id ?? null;
      }

      if (existing) {
        await db.update(schema.user).set({
          displayName: u.displayName || existing.displayName,
          email,
          department: u.department ?? existing.department,
          title: u.jobTitle ?? existing.title,
          role,
          managerId,
          updatedAt: new Date(),
        }).where(eq(schema.user.id, existing.id));
      } else {
        await db.insert(schema.user).values({
          id: uuid(),
          orgId,
          email,
          displayName: u.displayName ?? email,
          role,
          department: u.department ?? null,
          title: u.jobTitle ?? null,
          entraOid: u.id,
          managerId,
          isActive: true,
        });
      }
      synced++;
    }

    // Second pass: resolve managerIds that weren't available on first insert
    if (synced > 0) {
      for (const u of users) {
        const mgrOid = managerMap.get(u.id);
        if (!mgrOid) continue;
        const user = (await db.select().from(schema.user).where(eq(schema.user.entraOid, u.id)).limit(1))[0];
        const mgr = (await db.select().from(schema.user).where(eq(schema.user.entraOid, mgrOid)).limit(1))[0];
        if (user && mgr && user.managerId !== mgr.id) {
          await db.update(schema.user).set({ managerId: mgr.id }).where(eq(schema.user.id, user.id));
        }
      }
    }

    return { synced, warnings };
  } catch (e) {
    return { synced, warnings: [...warnings, `Graph sync error: ${(e as Error).message}`] };
  }
}
