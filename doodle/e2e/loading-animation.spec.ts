import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

for (const scenario of [
  { name: "desktop text", width: 1440, height: 900, photo: false },
  { name: "small mobile text", width: 360, height: 640, photo: false },
  { name: "mobile photo", width: 390, height: 844, photo: true },
]) {
  test(`native waiting sequence on ${scenario.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize(scenario);
    await page.route("**/api/account", route => route.fulfill({ json: { authenticated: false, email: null, balance: 0, freeRemaining: 4 } }));
    let finish!: () => void;
    const pending = new Promise<void>(resolve => { finish = resolve; });
    await page.route("**/api/generate", async route => {
      await pending;
      await route.fulfill({ contentType: "image/png", body: readFileSync("public/references/doodle-reference-kiss.png") });
    });
    await page.goto("/");
    await expect(page.locator(".usage-copy")).toContainText("4 free doodles left");
    if (scenario.photo) {
      const chooser = page.waitForEvent("filechooser");
      await page.getByRole("button", { name: "Use a photo", exact: true }).click();
      await (await chooser).setFiles("public/references/doodle-reference-kiss.png");
      await expect(page.getByRole("img", { name: "Selected photo" })).toBeVisible();
    } else await page.getByRole("textbox").fill("A small drawing for a lunchbox note");
    await page.getByRole("button", { name: "Create doodle", exact: true }).click();
    const card = page.locator(".doodle-stage-loading");
    await expect(card).toBeVisible();
    await expect(page.locator(".loading-animation")).toHaveAttribute("data-ready", "true");
    await expect(page.locator(".loading-lottie svg")).toBeVisible();
    await expect(card).toHaveCSS("background-color", "rgb(246, 223, 117)");
    const firstFrame = await page.locator(".loading-lottie").innerHTML();
    await expect.poll(() => page.locator(".loading-lottie").innerHTML()).not.toBe(firstFrame);
    await expect.poll(() => page.locator(".loading-message-track").evaluate(el => {
      const shift = new DOMMatrixReadOnly(getComputedStyle(el).transform).m42;
      const height = el.children[0].getBoundingClientRect().height;
      return shift < -0.5 && shift > -height + 0.5;
    }), { intervals: [50] }).toBe(true);
    await expect(page.locator(".loading-message-track")).toHaveAttribute("data-index", "1");
    await page.evaluate(() => document.fonts.ready);
    const fonts = await page.locator(".loading-primary").evaluate(el => getComputedStyle(el).fontFamily);
    expect(fonts).toContain("Bricolage");
    await card.scrollIntoViewIfNeeded();
    const box = (await card.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(350);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(scenario.width);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(scenario.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("waiting.png") });
    finish();
    await expect(card).toBeHidden();
    await expect(page.locator(".doodle-stage-result img")).toBeVisible();
  });
}

test("reduced motion uses the native 5.4-second still and static message", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/account", route => route.fulfill({ json: { authenticated: false, balance: 0, freeRemaining: 4 } }));
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  await page.route("**/api/generate", async route => { await pending; await route.abort(); });
  await page.goto("/");
  await expect(page.locator(".usage-copy")).toContainText("4 free doodles left");
  await page.getByRole("textbox").fill("A little flower");
  await page.getByRole("button", { name: "Create doodle", exact: true }).click();
  await expect(page.locator(".loading-animation")).toHaveAttribute("data-ready", "true");
  const still = await page.locator(".loading-lottie").innerHTML();
  await page.waitForTimeout(3200);
  expect(await page.locator(".loading-lottie").innerHTML()).toBe(still);
  await expect(page.locator(".loading-message-track")).toHaveAttribute("data-index", "0");
  finish();
});
