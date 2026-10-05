import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { localePath, SUPPORTED_LOCALES } from "../src/lib/i18n";

const png = fs.readFileSync("public/references/doodle-reference-kiss.png");

for (const width of [768, 1440, 1920]) {
  test(`desktop result shares one center across all languages at ${width}px`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 1000 });
    await page.route("**/api/account", route => route.fulfill({ json: { authenticated: false, email: null, balance: 0, freeRemaining: 2 } }));
    await page.route("**/api/generate", route => route.fulfill({ status: 200, contentType: "image/png", body: png }));
    for (const locale of SUPPORTED_LOCALES) {
      await page.goto(localePath(locale));
      await page.locator("#scene").fill("A cat holding a flower");
      await page.locator(".composer-footer > button").click();
      await expect(page.locator("#ready-title")).toBeVisible();
      const centers = await page.locator(".doodle-workspace-ready").evaluate(element => {
        const center = (selector: string) => {
          const rect = element.querySelector(selector)!.getBoundingClientRect();
          return rect.left + rect.width / 2;
        };
        const textCenter = (selector: string) => {
          const range = document.createRange();
          range.selectNodeContents(element.querySelector(selector)!);
          const rect = range.getBoundingClientRect();
          return rect.left + rect.width / 2;
        };
        return { image: center(".doodle-stage"), heading: center("#ready-title"), headingText: textCenter("#ready-title"), actions: center(".result-actions"), usageText: textCenter(".workspace-usage span") };
      });
      for (const [name, center] of Object.entries(centers)) {
        expect(Math.abs(center - centers.image), `${locale} ${name} aligns with image`).toBeLessThanOrEqual(1);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      if (locale === "en" || locale === "ar") {
        await page.screenshot({ path: testInfo.outputPath(`${locale}-${width}-result.png`), fullPage: true });
      }
    }
  });
}
