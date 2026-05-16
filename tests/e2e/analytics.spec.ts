import { test, expect } from "@playwright/test";
import { signInAs } from "./fixtures/sign-in";

test.describe("analytics", () => {
  test("admin sees charts and the analytics sections", async ({ page }) => {
    await signInAs(page, "admin");
    await page.goto("/analytics");

    // Scope to <main> so off-screen drawer duplicates (icons, etc.) don't
    // shadow the visible analytics charts.
    const main = page.locator("main");

    // Recharts renders SVGs for the QoQ trend, UoM mix, and thrust allocation.
    const svgs = main.locator("svg");
    await expect(svgs.first()).toBeVisible({ timeout: 15_000 });
    expect(await svgs.count()).toBeGreaterThan(0);

    // Headline section labels — at least one must be present.
    await expect(
      main
        .getByText(/QoQ|UoM mix|performance heatmap|manager effectiveness|thrust/i)
        .first(),
    ).toBeVisible();
  });
});
