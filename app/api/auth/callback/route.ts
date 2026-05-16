import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForUser, isEntraConfigured } from "@/lib/auth/msal-adapter";
import { createToken, setSessionCookie } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  if (!isEntraConfigured()) {
    return NextResponse.redirect(new URL("/sign-in?reason=entra_not_configured", base));
  }
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/sign-in?reason=missing_code", base));
  try {
    const u = await exchangeCodeForUser(code);
    const token = createToken({ userId: u.userId, authMode: "entra" });
    await setSessionCookie(token);
    return NextResponse.redirect(new URL("/dashboard", base));
  } catch (e) {
    return NextResponse.redirect(
      new URL(`/sign-in?reason=${encodeURIComponent(String(e))}`, base),
    );
  }
}
