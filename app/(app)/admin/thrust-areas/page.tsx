import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getThrustAreas } from "@/lib/db/queries";
import { PageHeader } from "@/components/dashboards/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function ThrustAreasPage() {
  const session = await requireSession();
  if (session.role !== "admin") redirect("/dashboard");
  const thrustAreas = await getThrustAreas(session.orgId);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Thrust areas"
        description="Strategic pillars used to align goals across the org."
      />
      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-[hsl(var(--border-subtle))]">
            {thrustAreas.map((t) => (
              <li key={t.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="size-3 rounded-full" style={{ backgroundColor: t.color }} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="text-xs text-[hsl(var(--fg-muted))]">{t.description ?? "—"}</div>
                </div>
                <Badge tone={t.isActive ? "success" : "neutral"}>
                  {t.isActive ? "Active" : "Inactive"}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
