import "server-only";

/**
 * Microsoft Graph integration (stub).
 *
 * In live mode this would:
 *  - Authenticate via MSAL client credentials with `User.Read.All` and `User.Read` scopes
 *  - Page through `/v1.0/users` and `/v1.0/users/{id}/manager`
 *  - Upsert into the `user` table with manager chain wiring + audit events
 *
 * In demo mode it returns the in-DB users so the UI never breaks.
 */

export function isGraphSyncEnabled() {
  return (
    process.env.GRAPH_SYNC_ENABLED === "true" &&
    !!process.env.AZURE_TENANT_ID &&
    !!process.env.AZURE_CLIENT_ID &&
    !!process.env.AZURE_CLIENT_SECRET
  );
}

export async function syncOrgFromGraph(orgId: string): Promise<{ synced: number; warnings: string[] }> {
  if (!isGraphSyncEnabled()) {
    return {
      synced: 0,
      warnings: [
        "Graph sync disabled. Set GRAPH_SYNC_ENABLED=true and provide AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET to enable.",
      ],
    };
  }
  // TODO: Implement live Graph paging when secrets are configured.
  return { synced: 0, warnings: [`Graph sync stub invoked for org ${orgId}.`] };
}
