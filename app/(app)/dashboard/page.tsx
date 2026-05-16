import { requireSession } from "@/lib/auth/session";
import { loadDashboardData } from "@/lib/db/queries";
import { EmployeeDashboard } from "@/components/dashboards/employee-dashboard";
import { ManagerDashboard } from "@/components/dashboards/manager-dashboard";
import { AdminDashboard } from "@/components/dashboards/admin-dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireSession();
  const data = await loadDashboardData(session);

  return (
    <div className="space-y-6">
      {data.role === "employee" && (
        <EmployeeDashboard
          session={session}
          cycle={data.cycle}
          sheet={data.sheet}
          goals={data.goals}
          checkIns={data.checkIns}
        />
      )}
      {data.role === "manager" && (
        <ManagerDashboard
          session={session}
          cycle={data.cycle}
          reports={data.reports}
          sheets={data.sheets}
          goals={data.goals}
          checkIns={data.checkIns}
        />
      )}
      {data.role === "admin" && (
        <AdminDashboard
          session={session}
          cycle={data.cycle}
          users={data.users}
          sheets={data.sheets}
          goals={data.goals}
          checkIns={data.checkIns}
        />
      )}
    </div>
  );
}
