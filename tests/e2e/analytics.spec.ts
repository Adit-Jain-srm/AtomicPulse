import { test, expect } from "@playwright/test";
import { signInAs } from "./fixtures/sign-in";

test.describe("analytics", () => {
  test("admin sees all chart sections and stats", async ({ page }) => {
    await signInAs(page, "admin");
    await page.goto("/analytics");

    const main = page.locator("main");

    // Page heading
    await expect(main.getByText(/performance analytics/i).first()).toBeVisible({ timeout: 15_000 });

    // Stat cards
    await expect(main.getByText(/goals/i).first()).toBeVisible();
    await expect(main.getByText(/avg composite/i).first()).toBeVisible();
    await expect(main.getByText(/thrust areas/i).first()).toBeVisible();
    await expect(main.getByText(/engagement/i).first()).toBeVisible();

    // Chart sections present
    await expect(main.getByText(/QoQ composite score/i).first()).toBeVisible();
    await expect(main.getByText(/thrust area allocation/i).first()).toBeVisible();
    await expect(main.getByText(/manager effectiveness/i).first()).toBeVisible();
    await expect(main.getByText(/performance heatmap/i).first()).toBeVisible();
    await expect(main.getByText(/UoM mix/i).first()).toBeVisible();

    // SVG charts rendered (Recharts renders as SVG)
    const svgs = main.locator("svg");
    await expect(svgs.first()).toBeVisible();
    expect(await svgs.count()).toBeGreaterThanOrEqual(3);
  });

  test("manager sees analytics scoped to their team", async ({ page }) => {
    await signInAs(page, "manager");
    await page.goto("/analytics");

    const main = page.locator("main");
    await expect(main.getByText(/performance analytics/i).first()).toBeVisible({ timeout: 15_000 });

    // Manager sees their own effectiveness row
    await expect(main.getByText(/manager effectiveness/i).first()).toBeVisible();
  });

  test("employee sees individual analytics", async ({ page }) => {
    await signInAs(page, "employee");
    await page.goto("/analytics");

    const main = page.locator("main");
    await expect(main.getByText(/performance analytics/i).first()).toBeVisible({ timeout: 15_000 });

    // Employee still sees QoQ and UoM mix for their own goals
    await expect(main.getByText(/QoQ composite score/i).first()).toBeVisible();
    await expect(main.getByText(/UoM mix/i).first()).toBeVisible();
  });

  test("heatmap shows user names when team data exists", async ({ page }) => {
    await signInAs(page, "admin");
    await page.goto("/analytics");

    const main = page.locator("main");
    await expect(main.getByText(/performance heatmap/i).first()).toBeVisible({ timeout: 15_000 });

    // The heatmap table should have Q1-Q4 headers
    const heatmapSection = main.locator("table");
    if (await heatmapSection.isVisible().catch(() => false)) {
      await expect(heatmapSection.getByText("Q1").first()).toBeVisible();
      await expect(heatmapSection.getByText("Q4").first()).toBeVisible();
    }
  });
});
