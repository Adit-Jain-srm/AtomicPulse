import { test, expect } from "@playwright/test";
import { signInAs } from "./fixtures/sign-in";

test.describe("admin", () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, "admin");
  });

  test("cycles page renders", async ({ page }) => {
    await page.goto("/admin/cycles");
    await expect(
      page.getByRole("heading", { name: /cycles?(\s*&\s*windows?)?/i }).first(),
    ).toBeVisible();
    // Seed creates an FY26 cycle with quarterly windows — one quarter chip is open.
    await expect(page.getByText(/FY26/i).first()).toBeVisible();
  });

  test("audit page renders", async ({ page }) => {
    await page.goto("/admin/audit");
    await expect(
      page.getByRole("heading", { name: /audit/i }).first(),
    ).toBeVisible();
  });

  test("achievement CSV export", async ({ page }) => {
    const res = await page.request.get("/api/exports/achievement.csv");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"] ?? "").toMatch(/text\/csv/i);
    const body = await res.text();
    expect(body).toContain("Employee");
  });

  test("audit CSV export", async ({ page }) => {
    const res = await page.request.get("/api/exports/audit.csv");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"] ?? "").toMatch(/text\/csv/i);
    const body = await res.text();
    // The audit export header row begins with "occurred_at,actor,..." per
    // app/api/exports/audit.csv/route.ts.
    expect(body).toMatch(/occurred_at|actor|action|entity_type/i);
  });
});
