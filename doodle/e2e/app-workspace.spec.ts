import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test("installed workspace has focused tabs and preserves a draft while browsing", async ({ page }) => {
  await page.route("**/api/account", route => route.fulfill({ json: { authenticated: false, email: null, balance: 0, freeRemaining: 2 } }));
  await page.goto("/?runtime=app");
  const nav = page.getByRole("navigation", { name: "Doodle app" });
  await expect(nav).toBeVisible();
  expect(await page.locator("#scene-title").evaluate(element => {
    const style = getComputedStyle(element);
    return parseFloat(style.letterSpacing) / parseFloat(style.fontSize);
  })).toBeCloseTo(-0.025);
  await expect(page.locator("#scene-title")).toHaveCSS("font-family", /Bricolage Grotesque/i);
  await expect(page.locator(".doodle-header")).toBeHidden();
  await page.getByRole("textbox").fill("A little cat holding a flower");
  await nav.getByRole("button", { name: "Ideas" }).click();
  await expect(page.getByRole("heading", { name: "Ideas", exact: true })).toBeVisible();
  await nav.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("textbox")).toHaveValue("A little cat holding a flower");
  await nav.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Nederlands", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("textbox")).toHaveValue("A little cat holding a flower");
  await nav.getByRole("button", { name: "Ideas" }).click();
  await page.getByRole("button", { name: /Try this idea:/ }).first().click();
  await expect(page.getByRole("textbox")).not.toHaveValue("A little cat holding a flower");
  await expect(page.getByRole("button", { name: "Create doodle", exact: true })).toBeEnabled();
});

test("website retains its header and has no installed app navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".doodle-header")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Doodle app" })).toHaveCount(0);
});

test("fullscreen desktop browser retains the wide website and discovery sections", async ({ page }) => {
  await page.setViewportSize({ width: 1512, height: 900 });
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = query => query.includes("display-mode")
      ? { matches: query.includes("fullscreen"), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => true } as MediaQueryList
      : original(query);
  });
  await page.goto("/");
  await expect(page.locator('.mobile-app-workspace')).toHaveAttribute('data-installed', 'false');
  await expect(page.locator(".doodle-header")).toBeVisible();
  await expect(page.locator(".site-footer")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Doodle app" })).toHaveCount(0);
  expect(await page.locator(".doodle-main").evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(900);
});
