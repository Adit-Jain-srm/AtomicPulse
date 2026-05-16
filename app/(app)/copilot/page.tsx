import { requireSession } from "@/lib/auth/session";
import { CopilotFullClient } from "@/components/copilot/copilot-full";

export const dynamic = "force-dynamic";

export default async function CopilotPage() {
  const session = await requireSession();
  return <CopilotFullClient role={session.role} userName={session.displayName} />;
}
