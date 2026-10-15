import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const sample = fs.readFileSync(process.env.GRID_SAMPLE ?? "public/references/doodle-reference-kiss.png");
const evidence = process.env.GRID_QA_DIR;

for (const width of [1280, 390, 320]) {
  test(`grid toggle preserves the original at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width > 700 ? 900 : 844 });
    let requests = 0;
    await page.route("**/api/account", route => route.fulfill({ json: { authenticated: false, email: null, balance: 0, freeRemaining: 4 } }));
    await page.route("**/api/generate", route => { requests += 1; return route.fulfill({ contentType: "image/png", body: sample }); });
    await page.goto(process.env.GRID_BASE_URL ?? "/");
    await page.getByRole("textbox").fill("A cat holding one small umbrella");
    await page.getByRole("button", { name: "Create doodle", exact: true }).click();
    const toggle = page.getByRole("button", { name: "Show grid" });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await page.evaluate(() => document.fonts.ready);
    if (evidence) await page.screenshot({ path: path.join(evidence, `web-${width}-off.png`), fullPage: true });
    const original = await page.getByAltText("Generated sticky-note doodle").getAttribute("src");
    await toggle.click();
    await expect(page.getByRole("button", { name: "Hide grid" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".grid-result-wrap .copy-grid-overlay")).toHaveCSS("opacity", "1");
    await expect(page.locator(".copy-grid-vertical")).toHaveCount(3);
    await expect(page.locator(".copy-grid-horizontal")).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator(".primary-action")).toHaveAttribute("href", original!);
    if (evidence) await page.screenshot({ path: path.join(evidence, `web-${width}-on.png`), fullPage: true });
    await page.getByRole("button", { name: "View larger", exact: true }).click();
    await expect(page.getByRole("dialog").locator(".copy-grid-overlay")).toBeVisible();
    if (evidence) await page.screenshot({ path: path.join(evidence, `web-${width}-enlarged.png`) });
    await page.getByRole("dialog").getByRole("button", { name: "Hide grid" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Show grid" })).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(".copy-grid-overlay")).toHaveCSS("opacity", "0");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.getByRole("button", { name: "Show grid" }).click();
    expect(await page.locator(".copy-grid-overlay").evaluate(element => parseFloat(getComputedStyle(element).transitionDuration))).toBeLessThan(0.001);
    expect(requests).toBe(1);
  });
}
