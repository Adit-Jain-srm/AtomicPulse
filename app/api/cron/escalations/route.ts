import { NextRequest, NextResponse } from "next/server";
import { runEscalationSweep } from "@/lib/domain/escalations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Vercel Cron sets a header; allow manual hits in dev
  const isCron = req.headers.get("x-vercel-cron") !== null;
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (process.env.NODE_ENV === "production" && !isCron && (!secret || auth !== `Bearer ${secret}`)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const result = await runEscalationSweep();
  return NextResponse.json({ ok: true, ...result, ranAt: new Date().toISOString() });
}
