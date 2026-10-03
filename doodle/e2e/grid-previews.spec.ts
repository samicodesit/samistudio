import { expect, test } from "@playwright/test";
import path from "node:path";
import { GRID_COPY } from "../src/lib/grid-copy";

const evidence = process.env.GRID_QA_DIR;

for (const { width, locale } of [{ width: 1280, locale: "en" }, { width: 390, locale: "en" }, { width: 320, locale: "ar" }] as const) {
  test(`shared doodle previews at ${width}px in ${locale}`, async ({ page }) => {
    const base = process.env.GRID_BASE_URL ?? test.info().project.use.baseURL;
    await page.setViewportSize({ width, height: width > 700 ? 900 : 844 });
    let generations = 0;
    await page.route("**/api/generate", route => { generations++; return route.abort(); });
    await page.route("**/api/account", route => route.fulfill({ json: { authenticated: false, email: null, balance: 0, freeRemaining: 2 } }));
    const localePrefix = locale === "en" ? "" : `/${locale}`;
    await page.goto(`${base}${localePrefix}/doodle-ideas?utm_source=pinterest`);
    const open = page.locator(".idea-image-button").first();
    await open.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: GRID_COPY[locale].show, exact: true })).toHaveAttribute("aria-pressed", "false");
    await dialog.getByRole("button", { name: GRID_COPY[locale].show, exact: true }).click();
    await expect(dialog.locator(".copy-grid-overlay")).toHaveCSS("opacity", "1");
    await expect(dialog.locator(".copy-grid-line")).toHaveCount(6);
    await expect(dialog.locator("a.dialog-download-action")).toHaveAttribute("href", /utm_source=pinterest/);
    const geometry = await dialog.evaluate(element => {
      const frame = element.querySelector(".doodle-grid-frame")!.getBoundingClientRect();
      const image = element.querySelector("img")!.getBoundingClientRect();
      const card = element.querySelector(".result-dialog-card")!.getBoundingClientRect();
      return { aligned: Math.abs(frame.width - image.width) < 1 && Math.abs(frame.height - image.height) < 1, fits: card.top >= 0 && card.bottom <= innerHeight && card.left >= 0 && card.right <= innerWidth };
    });
    expect(geometry).toEqual({ aligned: true, fits: true });
    await page.evaluate(() => document.fonts.ready);
    if (evidence) await page.screenshot({ path: path.join(evidence, `ideas-${width}-${locale}.png`) });
    await page.keyboard.press("Escape");
    await expect(open).toBeFocused();
    await open.click();
    await expect(dialog.getByRole("button", { name: GRID_COPY[locale].show, exact: true })).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("Escape");
    await page.goto(`${base}${localePrefix}/`);
    await page.locator(".doodle-stage-reference").click();
    await dialog.getByRole("button", { name: GRID_COPY[locale].show, exact: true }).click();
    await expect(dialog.locator(".copy-grid-overlay")).toHaveCSS("opacity", "1");
    if (evidence) await page.screenshot({ path: path.join(evidence, `example-${width}-${locale}.png`) });
    await page.keyboard.press("Escape");
    expect(generations).toBe(0);
  });
}

test("installed web Ideas preview keeps the Try action", async ({ page }) => {
  const base = process.env.GRID_BASE_URL ?? test.info().project.use.baseURL;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/account", route => route.fulfill({ json: { authenticated: false, email: null, balance: 0, freeRemaining: 2 } }));
  await page.goto(`${base}/?runtime=app#ideas`);
  await page.locator(".app-idea-preview").first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Show grid" }).click();
  await expect(dialog.locator(".copy-grid-overlay")).toHaveCSS("opacity", "1");
  if (evidence) await page.screenshot({ path: path.join(evidence, "installed-web-ideas.png") });
  const prompt = await dialog.locator(".doodle-preview-caption").textContent();
  await dialog.locator("button.dialog-download-action").click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("textbox")).toHaveValue(prompt!);
  await expect(page.locator('.app-bottom-nav button[aria-current="page"]')).toContainText("Create");
});
