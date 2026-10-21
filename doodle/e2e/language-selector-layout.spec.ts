import { expect, test } from "@playwright/test";
import { SUPPORTED_LOCALES, getCopy, localePath } from "../src/lib/i18n";

for (const width of [320, 390, 1440]) {
  test(`language selector separates flag, text and chevron in every locale at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/account", route => route.fulfill({ json: { authenticated: true, email: "nick@example.com", balance: 6, freeRemaining: 0, hasPurchased: true } }));
    for (const locale of SUPPORTED_LOCALES) {
      await page.goto(localePath(locale));
      await expect(page.locator(".account-menu")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const summary = page.locator(".language-switcher summary");
      const flag = await summary.locator("img").boundingBox();
      const label = await summary.locator(".language-current-label").boundingBox();
      const chevron = await summary.locator(".language-chevron").boundingBox();
      expect(flag).not.toBeNull(); expect(chevron).not.toBeNull();
      const separated = (a: NonNullable<typeof flag>, b: NonNullable<typeof flag>) => a.x + a.width <= b.x - 1 || b.x + b.width <= a.x - 1;
      expect(separated(flag!, chevron!)).toBe(true);
      if (label) expect(separated(label, chevron!)).toBe(true);
      expect(await summary.evaluate(el => getComputedStyle(el, "::after").display)).toBe("none");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await summary.click();
      await expect(summary).toHaveAttribute("aria-expanded", "true");
      const menu = page.locator(".language-switcher nav");
      await expect(menu).toBeVisible();
      await expect(menu.getByRole("link")).toHaveCount(SUPPORTED_LOCALES.length - 1);
      const menuBox = (await menu.boundingBox())!;
      expect(menuBox.x).toBeGreaterThanOrEqual(0);
      expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(width);
      for (const item of SUPPORTED_LOCALES.filter(item => item !== locale)) {
        await expect(menu.getByRole("link", { name: getCopy(item).localeLabel, exact: true })).toHaveAttribute("href", localePath(item));
      }
      await page.keyboard.press("Escape");
      await expect(summary).toHaveAttribute("aria-expanded", "false");
      await expect(summary).toBeFocused();
      await expect(page.locator(".language-switcher")).toHaveAttribute("data-state", "closed");
      if (locale === "en" || locale === "ar") {
        await summary.evaluate(el => el.blur());
        await page.mouse.move(0, 0);
        await page.locator(".doodle-header").screenshot({ path: testInfo.outputPath(`${locale}.png`) });
      }
    }
  });
}

test("long labels also fit beside sign-in on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/account", route => route.fulfill({ json: { authenticated: false, email: null, balance: 0, freeRemaining: 4 } }));
  await page.goto("/pt-br");
  await expect(page.locator(".account-sign-in-action")).toBeVisible();
  const trigger = (await page.locator(".language-switcher summary").boundingBox())!;
  const account = (await page.locator(".web-account-slot").boundingBox())!;
  expect(trigger.x + trigger.width).toBeLessThanOrEqual(account.x);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
