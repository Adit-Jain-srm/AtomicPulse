import { expect, type Page } from "@playwright/test";

export type DemoRole = "employee" | "manager" | "admin";

export type DemoUser = {
  email: string;
  displayName: string;
};

/**
 * Default seeded persona per role, chosen for a clean state in the tests:
 * - employee → Diego Alvarez (draft sheet — clean for goal submission flows)
 * - manager  → Morgan Chen   (has Alex Rivera submitted to him for review)
 * - admin    → Priya Sharma  (Head of HR / admin)
 *
 * See `scripts/seed.ts` for the canonical list.
 */
export const DEMO_USERS: Record<DemoRole, DemoUser> = {
  employee: { email: "diego@atomic.demo", displayName: "Diego Alvarez" },
  manager: { email: "morgan@atomic.demo", displayName: "Morgan Chen" },
  admin: { email: "priya@atomic.demo", displayName: "Priya Sharma" },
};

/**
 * Additional convenience handles used by tests that need a specific seeded
 * fixture (e.g. an employee with an approved sheet so check-ins are open).
 */
export const SEEDED_USERS = {
  alex: { email: "alex@atomic.demo", displayName: "Alex Rivera" }, // submitted under Morgan
  jordan: { email: "jordan@atomic.demo", displayName: "Jordan Park" }, // approved under Morgan
  sana: { email: "sana@atomic.demo", displayName: "Sana Khan" }, // locked under Morgan
  tomas: { email: "tomas@atomic.demo", displayName: "Tomás Silva" }, // submitted under Ravi
  morgan: { email: "morgan@atomic.demo", displayName: "Morgan Chen" },
  ravi: { email: "ravi@atomic.demo", displayName: "Ravi Kapoor" },
  priya: { email: "priya@atomic.demo", displayName: "Priya Sharma" },
} as const;

/**
 * Sign in to the demo persona switcher and wait until the dashboard renders.
 * Accepts either a role keyword or an explicit `{ email, displayName }` user.
 */
export async function signInAs(
  page: Page,
  who: DemoRole | DemoUser,
): Promise<DemoUser> {
  const user = typeof who === "string" ? DEMO_USERS[who] : who;

  // Authenticated sessions redirect /sign-in away from the persona switcher.
  await page.request.post("/api/auth/sign-out").catch(() => {});

  await page.goto("/sign-in");

  // If the sign-in panel renders the hero view (when both Entra & Demo are
  // enabled), surface the demo persona switcher first.
  const tryDemoBtn = page.getByRole("button", { name: /try demo mode/i });
  if (await tryDemoBtn.isVisible().catch(() => false)) {
    await tryDemoBtn.click();
  }

  const search = page.getByPlaceholder(/search by name, role, or department/i);
  await search.waitFor({ state: "visible" });
  await search.fill(user.email);

  const row = page
    .getByRole("button", { name: new RegExp(escapeRegex(user.displayName), "i") })
    .first();
  await expect(row).toBeVisible();
  await row.click();

  await page.waitForURL(/\/dashboard(?:\/|$|\?)/, { timeout: 15_000 });
  return user;
}

/**
 * Sign the current session out via the API and confirm the redirect target is
 * the sign-in page. Subsequent navigations to protected routes will redirect.
 */
export async function signOut(page: Page): Promise<void> {
  const res = await page.request.post("/api/auth/sign-out");
  // The route returns a 302/307 redirect to /sign-in. Playwright follows it
  // automatically, so the final URL should land on /sign-in.
  if (!res.url().includes("/sign-in")) {
    throw new Error(
      `Expected sign-out to redirect to /sign-in, got ${res.url()} (status ${res.status()})`,
    );
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
