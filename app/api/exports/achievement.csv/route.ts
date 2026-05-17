import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { buildAchievementRows, rowsToCsv } from "@/lib/exports/achievement";

export async function GET() {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  try {
    const rows = await buildAchievementRows(session);
    const csv = rowsToCsv(rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="atomic-pulse-achievement-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[export/achievement.csv]", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
