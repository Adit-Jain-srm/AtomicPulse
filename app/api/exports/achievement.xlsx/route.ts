import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { buildAchievementRows, rowsToXlsx } from "@/lib/exports/achievement";

export async function GET() {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  const rows = await buildAchievementRows(session);
  const buf = rowsToXlsx(rows);
  const body = new Uint8Array(buf);
  return new NextResponse(body as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="atomic-pulse-achievement-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
