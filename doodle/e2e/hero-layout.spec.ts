import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { localePath, SUPPORTED_LOCALES } from "../src/lib/i18n";

test("desktop artwork stays intact and the compact phone composer keeps its animated hint", async ({ page }) => {
  await page.route("**/api/account", route => route.fulfill({ json: { authenticated: false, email: null, balance: 0, freeRemaining: 2 } }));
  fs.mkdirSync("test-results/hero", { recursive: true });
  for (const width of [768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator(".usage-copy")).toHaveText("2 free doodles left");
    const cat = page.locator(".doodle-stage-reference img");
    await expect.poll(() => cat.evaluate(e => (e as HTMLImageElement).complete)).toBe(true);
    const frame = (await page.locator(".doodle-stage-reference").boundingBox())!;
    const image = (await cat.boundingBox())!;
    expect(image.y + image.height).toBeLessThanOrEqual(frame.y + frame.height + 1);
    expect(image.width).toBeLessThanOrEqual(frame.width);
    await expect(cat).toHaveCSS("object-fit", "contain");
    await expect(page.locator(".landing-example-papers img")).toBeVisible();
    await page.getByRole("textbox").fill("A cat holding a small flower");
    await page.locator(".usage-copy").click();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `test-results/hero/web-en-${width}.png` });
  }
  for (const item of [{width:390,route:"/",name:"web-en-390"}, {width:320,route:"/",name:"web-en-320"}, {width:390,route:"/ar",name:"web-ar-390"}, {width:390,route:"/?runtime=play",name:"app-en-390"}, {width:320,route:"/ar?runtime=play",name:"app-ar-320"}]) {
    await page.setViewportSize({width:item.width,height:844});
    await page.goto(item.route);
    await expect(page.locator("#scene-title")).toBeVisible();
    await expect(page.locator(".animated-prompt-hint")).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveValue("");
    await expect(page.locator(".animated-prompt-hint")).toContainText(/\S{3}/);
    await expect(page.locator(".doodle-stage-reference")).toBeHidden();
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole("textbox").fill("A cat holding a small flower");
    await page.locator(".usage-copy").click();
    await page.screenshot({path:`test-results/hero/${item.name}.png`});
    const input = (await page.locator(".doodle-composer").boundingBox())!;
    await page.locator(".detail-toggle").click();
    await expect(page.locator(".detail-selector")).toHaveAttribute("data-expanded","false");
    expect((await page.locator(".doodle-composer").boundingBox())!.y).toBe(input.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(item.width);
  }
});

test("all public translations fit beside the drawer at phone and desktop widths", async ({ page }) => {
  test.setTimeout(120_000);
  await page.route("**/api/account", route => route.fulfill({ json: { authenticated: false, email: null, balance: 0, freeRemaining: 2 } }));
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({width,height:900});
    for (const locale of SUPPORTED_LOCALES) {
      await page.goto(localePath(locale));
      await expect(page.locator(".usage-copy")).not.toBeEmpty();
      const input = (await page.locator(".doodle-composer").boundingBox())!;
      const rail = (await page.locator(".detail-drawer").boundingBox())!;
      const hint = (await page.locator(width < 700 ? ".scene-hint" : ".landing-intro p").boundingBox())!;
      expect(hint.y + hint.height).toBeLessThanOrEqual(input.y);
      expect(locale === "ar" ? hint.x >= rail.x + rail.width : hint.x + hint.width <= rail.x).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.screenshot({path:`test-results/hero/${locale}-${width}-translation.png`});
    }
  }
});
