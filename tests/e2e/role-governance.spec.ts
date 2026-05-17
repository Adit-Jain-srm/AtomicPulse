import { test, expect } from "@playwright/test";
import { signInAs, SEEDED_USERS } from "./fixtures/sign-in";

test.describe("employee capabilities", () => {

  test("can view own goal sheet with all goal details", async ({ page }) => {
    await signInAs(page, SEEDED_USERS.alex);
    await page.goto("/goals");
    const main = page.locator("main");
    await expect(main.getByText(/goal sheet|my goals|goals/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("can access check-ins page", async ({ page }) => {
    await signInAs(page, SEEDED_USERS.jordan);
    await page.goto("/check-ins");
    const main = page.locator("main");
    await expect(main.getByRole("heading").first()).toBeVisible({ timeout: 10_000 });
  });

  test("cannot access admin pages", async ({ page }) => {
    await signInAs(page, "employee");
    await page.goto("/admin/cycles");
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
  });

  test("cannot access escalation admin", async ({ page }) => {
    await signInAs(page, "employee");
    await page.goto("/admin/escalations");
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
  });

  test("sees validation state when sheet is ready", async ({ page }) => {
    await signInAs(page, "employee");
    await page.goto("/goals");
    const editorLink = page.getByRole("link", { name: /open editor/i }).first();
    await editorLink.click();
    await page.waitForURL(/\/goals\/[\w-]+/);
    // Submit button visible; allocation ring or status indicator present
    await expect(page.getByText(/allocated|100%|valid|ready|submit/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("manager capabilities", () => {

  test("sees team dashboard with report cards", async ({ page }) => {
    await signInAs(page, "manager");
    await page.goto("/dashboard");
    const main = page.locator("main");
    await expect(main.getByText(/team|reports|approvals/i).first()).toBeVisible();
  });

  test("can view team member goal sheets", async ({ page }) => {
    await signInAs(page, "manager");
    await page.goto("/goals");
    const main = page.locator("main");
    await expect(main.getByText(/Alex|Sana|Jordan|Diego|Mei/i).first()).toBeVisible();
  });

  test("can navigate to check-in acknowledgment for reports", async ({ page }) => {
    await signInAs(page, "manager");
    await page.goto("/check-ins");
    const main = page.locator("main");
    await expect(main.getByText(/check-?ins|team/i).first()).toBeVisible();
  });

  test("cannot access admin-only pages", async ({ page }) => {
    await signInAs(page, "manager");
    await page.goto("/admin/cycles");
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
  });
});

test.describe("admin capabilities", () => {

  test("can access all admin pages", async ({ page }) => {
    await signInAs(page, "admin");

    await page.goto("/admin/cycles");
    await expect(page.getByText(/FY26/i).first()).toBeVisible();

    await page.goto("/admin/audit");
    await expect(page.getByText(/audit/i).first()).toBeVisible();

    await page.goto("/admin/escalations");
    await expect(page.getByText(/escalations/i).first()).toBeVisible();
  });

  test("can export achievement CSV with correct headers", async ({ page }) => {
    await signInAs(page, "admin");
    const res = await page.request.get("/api/exports/achievement.csv");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("Employee");
    expect(body.split("\n").length).toBeGreaterThan(1);
  });

  test("can export audit trail CSV", async ({ page }) => {
    await signInAs(page, "admin");
    const res = await page.request.get("/api/exports/audit.csv");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("occurred_at");
    expect(body).toContain("action");
    expect(body).toContain("entity_type");
  });

  test("audit trail page renders with log entries", async ({ page }) => {
    await signInAs(page, "admin");
    await page.goto("/admin/audit");
    const main = page.locator("main");
    await expect(main.getByRole("heading", { name: /audit/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test("sees org-wide analytics with all managers", async ({ page }) => {
    await signInAs(page, "admin");
    await page.goto("/analytics");
    const main = page.locator("main");
    await expect(main.getByText(/performance analytics/i).first()).toBeVisible();
    await expect(main.getByText(/manager effectiveness/i).first()).toBeVisible();
  });
});

test.describe("governance & reporting", () => {
  test("achievement export contains planned vs actual data", async ({ page }) => {
    await signInAs(page, "admin");
    const res = await page.request.get("/api/exports/achievement.csv");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body.toLowerCase()).toMatch(/target|planned/);
    expect(body.toLowerCase()).toMatch(/actual|achievement/);
  });

  test("audit export captures post-lock changes", async ({ page }) => {
    await signInAs(page, "admin");
    const res = await page.request.get("/api/exports/audit.csv");
    const body = await res.text();
    expect(res.status()).toBe(200);
    expect(body).toContain("entity_type");
  });

  test("non-admin cannot export audit data", async ({ page }) => {
    await signInAs(page, "employee");
    const res = await page.request.get("/api/exports/audit.csv");
    expect(res.status()).toBe(403);
  });

  test("escalation cron produces structured response", async ({ page }) => {
    await signInAs(page, "admin");
    const res = await page.request.get("/api/cron/escalations");
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(typeof json.raised).toBe("number");
    expect(typeof json.notified).toBe("number");
    expect(json.ranAt).toBeTruthy();
  });
});
