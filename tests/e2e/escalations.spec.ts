import { test, expect } from "@playwright/test";
import { signInAs } from "./fixtures/sign-in";

test.describe("escalations", () => {
  test("admin sees escalation rules and event log", async ({ page }) => {
    await signInAs(page, "admin");
    await page.goto("/admin/escalations");

    const main = page.locator("main");
    await expect(main.getByText(/escalations/i).first()).toBeVisible();
    await expect(main.getByText(/rules/i).first()).toBeVisible();

    // Seeded rules visible
    await expect(main.getByText(/no_submit/i).first()).toBeVisible();
    await expect(main.getByText(/no_approve/i).first()).toBeVisible();
    await expect(main.getByText(/no_checkin/i).first()).toBeVisible();

    // Chain steps visible
    await expect(main.getByText(/owner/i).first()).toBeVisible();
    await expect(main.getByText(/manager/i).first()).toBeVisible();
  });

  test("employee cannot access escalation admin page", async ({ page }) => {
    await signInAs(page, "employee");
    await page.goto("/admin/escalations");
    // Should redirect to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("cron endpoint returns success in dev mode", async ({ page }) => {
    await signInAs(page, "admin");
    const res = await page.request.get("/api/cron/escalations");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.raised).toBe("number");
    expect(typeof body.notified).toBe("number");
  });
});
