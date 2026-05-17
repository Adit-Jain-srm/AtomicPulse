import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { exchangeCodeForUser, isEntraConfigured } from "@/lib/auth/msal-adapter";
import { createToken, setSessionCookie } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  if (!isEntraConfigured()) {
    return NextResponse.redirect(new URL("/sign-in?reason=entra_not_configured", base));
  }

  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    const desc = req.nextUrl.searchParams.get("error_description") ?? error;
    return NextResponse.redirect(new URL(`/sign-in?reason=${encodeURIComponent(desc)}`, base));
  }
  if (!code) {
    return NextResponse.redirect(new URL("/sign-in?reason=missing_code", base));
  }

  try {
    const entraUser = await exchangeCodeForUser(code);
    const db = getDb();

    // Upsert user by entraOid (Azure AD object ID is the stable identifier)
    let existing = (await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.entraOid, entraUser.entraOid))
      .limit(1))[0];

    if (!existing) {
      // Also check by email for pre-seeded users that don't have entraOid yet
      existing = (await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.email, entraUser.email))
        .limit(1))[0];
    }

    let userId: string;

    if (existing) {
      userId = existing.id;
      // Update entraOid and profile data if changed
      await db.update(schema.user).set({
        entraOid: entraUser.entraOid,
        displayName: entraUser.displayName || existing.displayName,
        department: entraUser.department ?? existing.department,
        title: entraUser.jobTitle ?? existing.title,
        updatedAt: new Date(),
      }).where(eq(schema.user.id, existing.id));
    } else {
      // Create new user — default to employee role; admin can upgrade via org sync
      userId = uuid();
      const defaultOrg = (await db.select().from(schema.org).limit(1))[0];
      if (!defaultOrg) {
        return NextResponse.redirect(new URL("/sign-in?reason=no_org_configured", base));
      }
      await db.insert(schema.user).values({
        id: userId,
        orgId: defaultOrg.id,
        email: entraUser.email,
        displayName: entraUser.displayName,
        role: "employee",
        department: entraUser.department ?? null,
        title: entraUser.jobTitle ?? null,
        entraOid: entraUser.entraOid,
        isActive: true,
      });
    }

    const token = createToken({ userId, authMode: "entra" });
    await setSessionCookie(token);
    return NextResponse.redirect(new URL("/dashboard", base));
  } catch (e) {
    console.error("[auth/callback] Entra exchange failed:", e);
    return NextResponse.redirect(
      new URL(`/sign-in?reason=${encodeURIComponent(String((e as Error).message ?? e))}`, base),
    );
  }
}
