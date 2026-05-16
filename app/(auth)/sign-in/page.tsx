import { listDemoIdentities } from "@/lib/auth/demo-adapter";
import { isEntraConfigured } from "@/lib/auth/msal-adapter";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { SignInClient } from "./sign-in-client";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  // Try-catch in case DB isn't seeded yet during first build
  let demoIdentities: Awaited<ReturnType<typeof listDemoIdentities>> = [];
  try {
    demoIdentities = await listDemoIdentities();
  } catch {
    // Show empty list, the client component handles it.
  }

  const authMode = (process.env.AUTH_MODE ?? "demo") as "demo" | "entra" | "both";
  const showDemo = authMode === "demo" || authMode === "both";
  const showEntra = (authMode === "entra" || authMode === "both") && isEntraConfigured();

  return (
    <SignInClient
      identities={demoIdentities}
      showDemo={showDemo}
      showEntra={showEntra}
    />
  );
}
