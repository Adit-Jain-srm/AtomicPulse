import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const enabled = process.env.TEAMS_WEBHOOK_INBOUND === "true";
  if (!enabled) {
    return NextResponse.json({ ok: false, reason: "TEAMS_WEBHOOK_INBOUND disabled" }, { status: 503 });
  }
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false }, { status: 400 });
  // Secret check (HMAC) when configured
  const secret = process.env.TEAMS_WEBHOOK_SECRET;
  const sig = req.headers.get("x-pulse-signature");
  if (secret && sig !== secret) {
    return NextResponse.json({ ok: false, reason: "bad signature" }, { status: 401 });
  }
  // Stub: accept payload and log. Real: dispatch action (approve / return) by goalSheetId.
  console.info("[teams.webhook]", body);
  return NextResponse.json({ ok: true });
}
