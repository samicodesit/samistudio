import { expect, test } from "@playwright/test";
import { SUPPORTED_LOCALES, localePath } from "../src/lib/i18n";

for (const width of [320, 390, 1280]) {
  test(`detail labels stay clear of the pull tab and viewport edges at ${width}px`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 844 });
    await page.route("**/api/account", route => route.fulfill({ json: { authenticated: false, email: null, balance: 0, freeRemaining: 2 } }));
    for (const locale of SUPPORTED_LOCALES) {
      await page.goto(localePath(locale));
      const tiles = page.getByRole("radio");
      for (let index = 0; index < 3; index++) {
        await tiles.nth(index).hover();
        const tooltip = page.locator(".detail-tooltip").nth(index);
        await expect(tooltip).toHaveCSS("opacity", "1");
        const label = (await tooltip.boundingBox())!;
        const handle = (await page.locator(".detail-handle").boundingBox())!;
        expect(label.y + label.height, `${locale} label clears the pull tab`).toBeLessThanOrEqual(handle.y - 4);
        expect(label.x, `${locale} label stays inside the left edge`).toBeGreaterThanOrEqual(0);
        expect(label.x + label.width, `${locale} label stays inside the right edge`).toBeLessThanOrEqual(width);
        await page.mouse.move(0, 0);
        await expect(tooltip).toHaveCSS("opacity", "0");
      }
      await tiles.nth(0).focus();
      await page.keyboard.press(locale === "ar" ? "ArrowLeft" : "ArrowRight");
      await expect(tiles.nth(1)).toBeFocused();
      await expect(page.locator(".detail-tooltip").nth(1)).toHaveCSS("opacity", "1");
      if (locale === "en" || locale === "ar" || locale === "nl") {
        await page.screenshot({ path: testInfo.outputPath(`${locale}-${width}-tooltip.png`), fullPage: true });
      }
      await page.keyboard.press("Escape");
      await expect(page.getByRole("radiogroup")).toHaveCount(0);
      await expect(page.locator(".detail-toggle")).toBeFocused();
      await page.locator(".detail-toggle").click();
      await expect(tiles.nth(1)).toHaveAttribute("aria-checked", "true");
    }
  });
}

test("keyboard focus shows one label when the pointer rests on another tile", async ({ page }) => {
  await page.route("**/api/account", route => route.fulfill({ json: { authenticated: false, email: null, balance: 0, freeRemaining: 2 } }));
  await page.goto("/");
  const tiles = page.getByRole("radio");
  await tiles.nth(2).hover();
  await tiles.nth(1).focus();
  await page.keyboard.press("Space");
  await expect(page.locator(".detail-tooltip").nth(1)).toHaveCSS("opacity", "1");
  await expect(page.locator(".detail-tooltip").nth(2)).toHaveCSS("opacity", "0");
  await page.getByRole("textbox").focus();
  await expect(page.locator(".detail-tooltip").nth(2)).toHaveCSS("opacity", "1");
});
