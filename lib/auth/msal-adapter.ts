import "server-only";
import { ConfidentialClientApplication, type Configuration, type AuthenticationResult } from "@azure/msal-node";

let _msalInstance: ConfidentialClientApplication | null = null;

function getMsalConfig(): Configuration {
  return {
    auth: {
      clientId: process.env.AZURE_CLIENT_ID!,
      authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
      clientSecret: process.env.AZURE_CLIENT_SECRET!,
    },
  };
}

function getMsalInstance(): ConfidentialClientApplication {
  if (!_msalInstance) {
    _msalInstance = new ConfidentialClientApplication(getMsalConfig());
  }
  return _msalInstance;
}

export function isEntraConfigured(): boolean {
  return !!(
    process.env.AZURE_CLIENT_ID &&
    process.env.AZURE_CLIENT_SECRET &&
    process.env.AZURE_TENANT_ID &&
    process.env.AZURE_REDIRECT_URI
  );
}

export async function buildSignInUrl(state: string): Promise<string> {
  if (!isEntraConfigured()) {
    throw new Error("Microsoft Entra ID is not configured. Set AZURE_CLIENT_ID/SECRET/TENANT_ID.");
  }
  const msal = getMsalInstance();
  const url = await msal.getAuthCodeUrl({
    scopes: ["openid", "profile", "email", "User.Read"],
    redirectUri: process.env.AZURE_REDIRECT_URI!,
    state,
    responseMode: "query",
  });
  return url;
}

export type EntraUser = {
  userId: string;
  email: string;
  displayName: string;
  entraOid: string;
  department?: string;
  jobTitle?: string;
};

export async function exchangeCodeForUser(code: string): Promise<EntraUser> {
  if (!isEntraConfigured()) {
    throw new Error("Entra not configured.");
  }
  const msal = getMsalInstance();
  const result: AuthenticationResult = await msal.acquireTokenByCode({
    code,
    scopes: ["openid", "profile", "email", "User.Read"],
    redirectUri: process.env.AZURE_REDIRECT_URI!,
  });

  if (!result.account) {
    throw new Error("Token acquired but no account returned from Entra.");
  }

  const claims = result.idTokenClaims as Record<string, unknown> | undefined;

  return {
    userId: "", // Will be resolved/created by the callback handler
    email: (claims?.preferred_username as string) ?? (claims?.email as string) ?? result.account.username,
    displayName: (claims?.name as string) ?? result.account.name ?? "Unknown",
    entraOid: result.account.homeAccountId.split(".")[0] ?? result.uniqueId,
    department: (claims?.department as string) ?? undefined,
    jobTitle: (claims?.jobTitle as string) ?? undefined,
  };
}

/**
 * Acquire a token for Microsoft Graph on behalf of the app (client credentials).
 * Used for org sync / user enumeration.
 */
export async function acquireGraphToken(): Promise<string> {
  if (!isEntraConfigured()) {
    throw new Error("Entra not configured for Graph access.");
  }
  const msal = getMsalInstance();
  const result = await msal.acquireTokenByClientCredential({
    scopes: ["https://graph.microsoft.com/.default"],
  });
  if (!result?.accessToken) {
    throw new Error("Failed to acquire Graph token.");
  }
  return result.accessToken;
}
