import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { loadDashboardData } from "@/lib/db/queries";
import { PageHeader } from "@/components/dashboards/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getDb, schema } from "@/lib/db/client";
import { Share2, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function SharedGoalsPage() {
  const session = await requireSession();
  const data = await loadDashboardData(session);
  const db = getDb();

  const links = await db.select().from(schema.sharedGoalLink).all();
  const sharedGoals = await db.select().from(schema.goal).where((g) => undefined as never).all().catch(() => []);
  // Find shared goals (source = 'shared')
  const allShared = await db.select().from(schema.goal).all();
  const myShared = allShared.filter((g) => {
    if (g.source !== "shared") return false;
    if (!data.cycle) return false;
    if (data.role === "employee") {
      return data.sheet ? g.sheetId === data.sheet.id : false;
    }
    if (data.role === "manager") {
      return data.sheets.some((s) => s.id === g.sheetId);
    }
    return true; // admin sees all
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Shared goals"
        title="Goals you share or are shared with"
        description="Push a primary goal to multiple people. Achievement and status sync automatically across linked goals."
        actions={
          <Button variant="ai" asChild>
            <Link href="/goals">
              <Sparkles className="size-4" /> Push from a sheet
            </Link>
          </Button>
        }
      />

      <Card>
        <div className="border-b border-[hsl(var(--border-subtle))] p-5">
          <div className="text-sm font-semibold tracking-tight">Linked goals</div>
          <div className="text-xs text-[hsl(var(--fg-muted))]">{myShared.length} entries</div>
        </div>
        <CardContent className="p-0">
          {myShared.length === 0 ? (
            <div className="p-10 text-center">
              <Share2 className="mx-auto size-9 text-[hsl(var(--fg-muted))]" />
              <div className="mt-3 text-sm font-medium">No shared goals yet</div>
              <div className="mt-1 text-xs text-[hsl(var(--fg-muted))]">
                Open a goal sheet, click &ldquo;Share&rdquo; on a goal, and pick recipients to push to multiple sheets in one shot.
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-[hsl(var(--border-subtle))]">
              {myShared.map((g) => (
                <li key={g.id} className="px-5">
                  <Link
                    href={`/goals/${g.sheetId}`}
                    className="flex items-center gap-4 -mx-5 px-5 py-3.5 hover:bg-[hsl(var(--surface-1))]"
                  >
                    <div className="grid size-9 place-items-center rounded-md ai-gradient text-white">
                      <Share2 className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{g.title}</div>
                      <div className="text-xs text-[hsl(var(--fg-muted))]">
                        weight {(g.weightageBp / 100).toFixed(0)}% · {g.uomType}
                      </div>
                    </div>
                    <Badge tone="info">Shared</Badge>
                    <ArrowRight className="size-4 text-[hsl(var(--fg-muted))]" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
