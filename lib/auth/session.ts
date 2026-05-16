import "server-only";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { unstable_cache } from "next/cache";

export type Role = "employee" | "manager" | "admin";

export type Session = {
  userId: string;
  orgId: string;
  email: string;
  displayName: string;
  role: Role;
  managerId: string | null;
  department: string | null;
  authMode: "demo" | "entra";
  expiresAt: number;
};

const COOKIE_NAME = "ap_session";

function getSecret(): string {
  return (
    process.env.SESSION_SECRET ??
    "dev-secret-change-me-please-32-bytes-long-ok"
  );
}

function sign(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function verifyToken(token: string): { userId: string; expiresAt: number; authMode: "demo" | "entra" } | null {
  try {
    const [bodyB64, sig] = token.split(".");
    if (!bodyB64 || !sig) return null;
    const body = JSON.parse(Buffer.from(bodyB64, "base64url").toString("utf8"));
    if (typeof body.expiresAt !== "number" || body.expiresAt < Date.now()) return null;

    const secrets = [getSecret()];
    const previous = process.env.SESSION_SECRET_PREVIOUS;
    if (previous) secrets.push(previous);
    const valid = secrets.some(
      (s) => crypto.timingSafeEqual(Buffer.from(sign(bodyB64, s)), Buffer.from(sig))
    );
    if (!valid) return null;
    return body;
  } catch {
    return null;
  }
}

export function createToken(input: { userId: string; authMode: "demo" | "entra"; ttlMs?: number }): string {
  const expiresAt = Date.now() + (input.ttlMs ?? 8 * 60 * 60 * 1000);
  const body = { userId: input.userId, expiresAt, authMode: input.authMode };
  const bodyB64 = Buffer.from(JSON.stringify(body)).toString("base64url");
  const sig = sign(bodyB64, getSecret());
  return `${bodyB64}.${sig}`;
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

const loadUser = (userId: string) =>
  unstable_cache(
    async () => {
      const db = getDb();
      const rows = await db.select().from(schema.user).where(eq(schema.user.id, userId)).limit(1);
      return rows[0] ?? null;
    },
    ["session-user", userId],
    { tags: [`user:${userId}`], revalidate: 60 }
  )();

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const body = verifyToken(token);
  if (!body) return null;
  const u = await loadUser(body.userId);
  if (!u || !u.isActive) return null;
  return {
    userId: u.id,
    orgId: u.orgId,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    managerId: u.managerId ?? null,
    department: u.department ?? null,
    authMode: body.authMode,
    expiresAt: body.expiresAt,
  };
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new Error("UNAUTHENTICATED");
  return s;
}
