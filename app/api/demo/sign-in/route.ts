import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findDemoUser } from "@/lib/auth/demo-adapter";
import { createToken, setSessionCookie } from "@/lib/auth/session";

const Body = z.object({ userId: z.string().min(1) });

export async function POST(req: NextRequest) {
  const mode = process.env.AUTH_MODE ?? "demo";
  if (mode !== "demo" && mode !== "both") {
    return NextResponse.json(
      { ok: false, error: { code: "forbidden", message: "Demo Mode is disabled." } },
      { status: 403 }
    );
  }
  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: "validation", message: "userId required" } },
      { status: 400 }
    );
  }
  const user = await findDemoUser(parsed.data.userId);
  if (!user) {
    return NextResponse.json(
      { ok: false, error: { code: "not_found", message: "User not found" } },
      { status: 404 }
    );
  }
  const token = createToken({ userId: user.id, authMode: "demo" });
  await setSessionCookie(token);
  return NextResponse.json({ ok: true, data: { userId: user.id } });
}
