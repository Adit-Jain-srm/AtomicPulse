import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";

export async function POST() {
  await clearSessionCookie();
  return NextResponse.redirect(new URL("/sign-in", process.env.APP_BASE_URL ?? "http://localhost:3000"));
}

export async function GET() {
  await clearSessionCookie();
  return NextResponse.redirect(new URL("/sign-in", process.env.APP_BASE_URL ?? "http://localhost:3000"));
}
