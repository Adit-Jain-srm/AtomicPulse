import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { buildSignInUrl, isEntraConfigured } from "@/lib/auth/msal-adapter";

export async function GET() {
  if (!isEntraConfigured()) {
    return NextResponse.redirect(
      new URL("/sign-in?reason=entra_not_configured", process.env.APP_BASE_URL ?? "http://localhost:3000")
    );
  }
  try {
    const state = crypto.randomBytes(16).toString("base64url");
    const url = await buildSignInUrl(state);
    return NextResponse.redirect(url);
  } catch (e) {
    return NextResponse.redirect(
      new URL(`/sign-in?reason=${encodeURIComponent(String(e))}`, process.env.APP_BASE_URL ?? "http://localhost:3000")
    );
  }
}
