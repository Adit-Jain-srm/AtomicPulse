import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { runEscalationSweep } from "@/lib/domain/escalations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const isCron = req.headers.get("x-vercel-cron") !== null;
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (process.env.NODE_ENV === "production" && !isCron && (!secret || auth !== `Bearer ${secret}`)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  try {
    const result = await runEscalationSweep();
    revalidateTag("escalations");
    return NextResponse.json({ ok: true, ...result, ranAt: new Date().toISOString() });
  } catch (err) {
    console.error("[cron/escalations]", err);
    return NextResponse.json({ ok: false, error: "Escalation sweep failed" }, { status: 500 });
  }
}
