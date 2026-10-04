import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
const png = fs.readFileSync(path.join(process.cwd(), "public/references/doodle-reference-kiss.png"));
async function setup(page: Page) {
  await page.route("**/api/account", route => route.fulfill({ json: { authenticated: false, email: null, balance: 0, freeRemaining: 2 } }));
}
test("detail tiles stay compact at every selection, width and Arabic direction", async ({ page }) => {
  test.setTimeout(60000);
  await setup(page);
  const folder = path.join(process.cwd(), "test-results/detail-levels/web");
  fs.mkdirSync(folder, { recursive: true });
  for (const item of [{ width: 1280, locale: "en", installed: false }, { width: 390, locale: "en", installed: false }, { width: 320, locale: "en", installed: false }, { width: 390, locale: "ar", installed: false }, { width: 390, locale: "en", installed: true }, { width: 320, locale: "en", installed: true }, { width: 320, locale: "ar", installed: true }]) {
    await page.setViewportSize({ width: item.width, height: 844 });
    await page.goto((item.locale === "en" ? "/" : "/ar") + (item.installed ? "?runtime=play" : ""));
    await page.getByRole("textbox").fill(item.locale === "ar" ? "قطة تحمل زهرة صغيرة" : "A cat holding a small flower");
    const tiles = page.getByRole("radio");
    await expect(tiles).toHaveCount(3);
    const boxes = [];
    for (let index = 0; index < 3; index++) {
      await tiles.nth(index).click();
      await expect(tiles.nth(index)).toHaveAttribute("aria-checked", "true");
      boxes.push(await tiles.nth(index).boundingBox());
      await page.mouse.move(1, 1);
      await page.locator("h1").click();
      await expect(page.locator(".detail-tooltip").nth(index)).toHaveCSS("opacity", "0");
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: path.join(folder, `${item.installed ? "app" : "web"}-${item.locale}-${item.width}-${index}.png`), fullPage: true });
    }
    expect(boxes.every(box => box?.width === 56 && box.height === 56)).toBe(true);
    const tile0 = await tiles.nth(0).boundingBox();
    const tile1 = await tiles.nth(1).boundingBox();
    expect(Math.abs(tile0!.x - tile1!.x)).toBe(56);
    await tiles.nth(2).focus();
    await page.keyboard.press(item.locale === "ar" ? "ArrowRight" : "ArrowLeft");
    await expect(tiles.nth(1)).toBeFocused();
    await expect(tiles.nth(1)).toHaveAttribute("aria-checked", "true");
    await expect(page.locator(".detail-tooltip").nth(1)).toHaveCSS("opacity", "1");
    await page.screenshot({ path: path.join(folder, `${item.installed ? "app" : "web"}-${item.locale}-${item.width}-focus.png`), fullPage: true });
    const dock = await page.locator(".detail-selector").boundingBox();
    const input = await page.locator(".doodle-composer").boundingBox();
    const rail = await page.locator(".detail-drawer").boundingBox();
    expect(Math.abs(dock!.y + dock!.height - input!.y)).toBeLessThan(1);
    expect(rail!.y + rail!.height).toBeGreaterThan(input!.y);
    const edgeInset = item.locale === "ar" ? rail!.x - input!.x : input!.x + input!.width - rail!.x - rail!.width;
    expect(edgeInset).toBeCloseTo(4);
    const handle = await page.locator(".detail-toggle").boundingBox();
    expect(handle!.x + handle!.width / 2).toBeCloseTo(rail!.x + rail!.width / 2);
    expect(tile0!.y + tile0!.height - input!.y).toBeLessThanOrEqual(1);
    expect(await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest(".doodle-composer")), { x: rail!.x + rail!.width / 2, y: input!.y + 8 })).toBe(true);
    await page.locator(".detail-toggle").click();
    if (item.installed && item.locale === "en") {
      await page.waitForTimeout(60);
      await page.screenshot({ path: path.join(folder, "app-en-390-transition.png"), fullPage: true });
    }
    await expect(page.getByRole("radiogroup")).toHaveCount(0);
    await expect(page.locator(".detail-selector")).toHaveAttribute("data-expanded", "false");
    await expect(page.locator(".detail-selector")).toHaveCSS("height", "80px");
    expect((await page.locator(".doodle-composer").boundingBox())!.y).toBeCloseTo(input!.y);
    if (item.installed) {
      const hint = await page.locator(".scene-hint").boundingBox();
      expect(hint!.y + hint!.height).toBeLessThan(input!.y);
      expect(input!.y - hint!.y - hint!.height).toBeLessThanOrEqual(13);
      expect(item.locale === "ar" ? hint!.x >= rail!.x + rail!.width : hint!.x + hint!.width <= rail!.x).toBe(true);
    }
    await expect(page.locator(".detail-drawer")).toHaveCSS("visibility", "hidden");
    await page.screenshot({ path: path.join(folder, `${item.installed ? "app" : "web"}-${item.locale}-${item.width}-collapsed.png`), fullPage: true });
    await page.locator(".detail-toggle").click();
    await expect(page.locator(".detail-selector")).toHaveCSS("height", "80px");
    await expect(tiles.nth(1)).toHaveAttribute("aria-checked", "true");
    const fonts = await page.evaluate(async () => {
      await document.fonts.ready;
      return { body: getComputedStyle(document.querySelector(".detail-tile")!).fontFamily,
        heading: getComputedStyle(document.querySelector("h1")!).fontFamily,
        loaded: [...document.fonts].filter(font => font.status === "loaded").map(font => font.family) };
    });
    expect(fonts.loaded.some(name => /Alexandria|IBM.Plex.Sans/.test(name))).toBe(true);
    expect(fonts.heading).toMatch(/Bricolage|Alexandria/);
    expect(fonts.loaded.some(name => /Bricolage|Alexandria/.test(name))).toBe(true);
    fs.writeFileSync(path.join(folder, item.locale + "-" + item.width + "-fonts.json"), JSON.stringify(fonts, null, 2));
  }
});
test("restores before Create, preserves ideas and locale returns, retries current input and redraws result input", async ({ page }) => {
  await setup(page);
  const requests: unknown[] = [];
  let attempt = 0;
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/generate", async route => {
    requests.push(route.request().postDataJSON());
    attempt++;
    if (attempt === 1) return route.fulfill({ status: 502, json: { error: "temporary_error" } });
    if (attempt === 2) await pending;
    return route.fulfill({ status: 200, contentType: "image/png", body: png });
  });
  await page.goto("/?runtime=play");
  await page.getByRole("radio", { name: "Medium", exact: true }).click();
  expect(requests).toHaveLength(0);
  await page.reload();
  await expect(page.getByRole("radio", { name: "Medium", exact: true })).toHaveAttribute("aria-checked", "true");
  await page.locator(".suggestions-list button").first().click();
  await expect(page.getByRole("radio", { name: "Medium", exact: true })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Refresh ideas" }).click();
  await expect(page.getByRole("radio", { name: "Medium", exact: true })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("textbox").fill("Two cats hug");
  await page.getByRole("button", { name: "Create doodle", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("textbox").fill("A dog with a flower");
  await page.getByRole("radio", { name: "Detailed", exact: true }).click();
  await page.getByRole("button", { name: "Create doodle", exact: true }).click();
  await expect(page.locator(".doodle-workspace-generating")).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(page.locator(".doodle-workspace-generating .doodle-stage")).toBeVisible();
  release();
  await expect(page.locator(".doodle-workspace-ready")).toBeVisible();
  await page.locator(".result-more-button").click();
  await page.getByRole("button", { name: "Redraw this idea", exact: true }).click();
  await expect(page.locator(".doodle-workspace-ready")).toBeVisible();
  expect(requests).toEqual([
    { scene: "Two cats hug", detailLevel: "medium" },
    { scene: "A dog with a flower", detailLevel: "detailed" },
    { scene: "A dog with a flower", detailLevel: "detailed" },
  ]);
  await page.getByRole("button", { name: "Draw something else", exact: true }).click();
  await expect(page.getByRole("radio", { name: "Detailed", exact: true })).toHaveAttribute("aria-checked", "true");
  await page.goto("/ar?auth=success");
  await expect(page.getByRole("radio").nth(2)).toHaveAttribute("aria-checked", "true");
  await page.goto("/?checkout=cancelled");
  await expect(page.getByRole("radio", { name: "Detailed", exact: true })).toHaveAttribute("aria-checked", "true");
});
test("blocked storage falls back to Simple and write failures never block creation", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "localStorage", {
    get() { throw new DOMException("Blocked", "SecurityError"); }, configurable: true,
  }));
  await setup(page);
  const requests: unknown[] = [];
  await page.route("**/api/generate", async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: "image/png", body: png });
  });
  await page.goto("/");
  await expect(page.getByRole("radio", { name: "Simple", exact: true })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radio", { name: "Medium", exact: true }).click();
  await page.getByRole("textbox").fill("A flower");
  await page.getByRole("button", { name: "Create doodle", exact: true }).click();
  await expect(page.locator(".doodle-workspace-ready")).toBeVisible();
  expect(requests).toEqual([{ scene: "A flower", detailLevel: "medium" }]);
});


test("reduced motion tucks the drawer away without a slide", async ({ page }) => {
  await setup(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?runtime=play");
  await page.getByRole("radio", { name: "Medium", exact: true }).click();
  expect(await page.locator(".detail-selector").evaluate(node => parseFloat(getComputedStyle(node).transitionDuration))).toBeLessThanOrEqual(0.001);
  await page.locator(".detail-toggle").click();
  expect(await page.locator(".detail-drawer").evaluate(node => Math.max(...getComputedStyle(node).transitionDuration.split(",").map(parseFloat)))).toBeLessThanOrEqual(0.001);
  await expect(page.getByRole("radiogroup")).toHaveCount(0);
  await page.locator(".detail-toggle").click();
  await expect(page.getByRole("radio", { name: "Medium", exact: true })).toHaveAttribute("aria-checked", "true");
});
