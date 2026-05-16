import { Badge } from "./badge";
import { Circle, CheckCircle2, Activity, AlertTriangle } from "lucide-react";

const map = {
  not_started: { tone: "neutral" as const, label: "Not started", icon: Circle },
  on_track: { tone: "info" as const, label: "On track", icon: Activity },
  completed: { tone: "success" as const, label: "Completed", icon: CheckCircle2 },
  at_risk: { tone: "warn" as const, label: "At risk", icon: AlertTriangle },
};

export function StatusPill({ status, className }: { status: keyof typeof map; className?: string }) {
  const m = map[status] ?? map.not_started;
  const I = m.icon;
  return (
    <Badge tone={m.tone} className={className}>
      <I className="size-3" />
      {m.label}
    </Badge>
  );
}
