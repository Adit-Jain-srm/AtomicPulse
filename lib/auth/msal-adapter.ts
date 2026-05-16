import "server-only";

/**
 * MSAL Entra ID adapter — interface only.
 *
 * Real implementation requires `@azure/msal-node` plus an Entra app registration.
 * For the hackathon scaffold, we expose the same interface that the sign-in
 * route consumes; when AZURE_CLIENT_ID is unset, the sign-in page hides this path
 * and the function below throws with a clear, user-friendly message.
 *
 * Production wiring (post-hackathon):
 *   1. `npm install @azure/msal-node`
 *   2. Implement getAuthCodeUrl + acquireTokenByCode using ConfidentialClientApplication.
 *   3. Validate id_token via JWKS, upsert user keyed by entra_oid, then call createToken / setSessionCookie.
 */

export function isEntraConfigured(): boolean {
  return !!(
    process.env.AZURE_CLIENT_ID &&
    process.env.AZURE_CLIENT_SECRET &&
    process.env.AZURE_TENANT_ID &&
    process.env.AZURE_REDIRECT_URI
  );
}

export async function buildSignInUrl(_state: string): Promise<string> {
  if (!isEntraConfigured()) {
    throw new Error("Microsoft Entra ID is not configured. Set AZURE_CLIENT_ID/SECRET/TENANT_ID.");
  }
  // Stub — real impl uses ConfidentialClientApplication.getAuthCodeUrl.
  const tenant = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const redirect = encodeURIComponent(process.env.AZURE_REDIRECT_URI!);
  const scopes = encodeURIComponent("openid profile email User.Read");
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirect}&scope=${scopes}&response_mode=query`;
}

export type EntraUser = {
  userId: string;
  email: string;
  displayName: string;
  entraOid: string;
};

export async function exchangeCodeForUser(_code: string): Promise<EntraUser> {
  throw new Error(
    "Entra callback handler is stubbed. Install @azure/msal-node and complete the integration in lib/auth/msal-adapter.ts."
  );
}
