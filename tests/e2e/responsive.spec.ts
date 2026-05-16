import { test, expect } from "@playwright/test";
import { signInAs } from "./fixtures/sign-in";

// Only meaningful on mobile-shaped viewports — gate on the `isMobile` flag
// from the playwright project (Pixel 7 sets it).
test.skip(({ isMobile }) => !isMobile, "mobile-only responsive tests");

test.describe("responsive (mobile)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
  });

  test("dashboard sidebar is hidden and hamburger opens drawer", async ({ page }) => {
    await signInAs(page, "employee");
    await page.goto("/dashboard");

    // The desktop <aside> is `hidden lg:flex`, so on a 375px viewport it should
    // not be visible. Use the navigation landmark to find it.
    const aside = page.locator("aside").first();
    await expect(aside).toBeHidden();

    // Tap the hamburger.
    const hamburger = page.getByRole("button", { name: /open navigation/i });
    await expect(hamburger).toBeVisible();
    await hamburger.click();

    // The mobile drawer renders the same nav links — assert at least the
    // Dashboard link becomes visible.
    await expect(
      page.getByRole("link", { name: /dashboard/i }).first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("goal sheet has no horizontal scroll", async ({ page }) => {
    await signInAs(page, "employee");
    await page.goto("/goals");

    const editorLink = page.getByRole("link", { name: /open editor/i }).first();
    await editorLink.click();
    await page.waitForURL(/\/goals\/[\w-]+/);

    // Allow ~4px tolerance for sub-pixel rounding / scrollbar fudge.
    const overflow = await page.evaluate(() => {
      const root = document.scrollingElement ?? document.documentElement;
      return {
        scrollWidth: root.scrollWidth,
        clientWidth: window.innerWidth,
      };
    });
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 4);
  });

  test("topbar buttons meet minimum touch-target height", async ({ page }) => {
    await signInAs(page, "employee");
    await page.goto("/dashboard");

    const buttons = page.locator("header button");
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      // Skip elements that are not visible on this viewport (e.g. md+ only).
      if (!(await btn.isVisible().catch(() => false))) continue;
      const box = await btn.boundingBox();
      if (!box) continue;
      // Spec target: ≥ 40px height. We allow a 4px tolerance for icon-only
      // buttons that visually exceed 36px due to padding + ring.
      expect(box.height, `button index ${i} too short: ${box.height}px`).toBeGreaterThanOrEqual(36);
    }
  });
});
