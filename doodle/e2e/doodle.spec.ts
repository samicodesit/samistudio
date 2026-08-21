import { expect, test, type Page, type Route } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const referencePng = fs.readFileSync(path.join(process.cwd(), "public/references/doodle-reference-kiss.png"));

async function openTool(page: Page, path = "/") {
  await page.goto(path);
  await expect(page.getByRole("heading", { name: "What should we doodle?" })).toBeVisible();
}

async function fulfillImage(route: Route) {
  await route.fulfill({ status: 200, contentType: "image/png", body: referencePng });
}

async function expectNoOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  expect(overflow).toBe(true);
}

async function expectSuggestionsFit(page: Page) {
  const suggestions = page.locator(".suggestions-list");
  const fits = await suggestions.evaluate((element) => element.scrollWidth <= element.clientWidth);
  expect(fits).toBe(true);
}

test.describe("Doodle mobile workflow", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("creates, downloads, retries, and starts a new scene", async ({ page }, testInfo) => {
    await openTool(page);
    await page.reload();
    await expect(page.getByRole("heading", { name: "What should we doodle?" })).toBeVisible();
    await expectNoOverflow(page);
    await expectSuggestionsFit(page);

    await page.getByRole("button", { name: "View example doodle larger" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();

    const createButton = page.getByRole("button", { name: /Create doodle/ });
    await expect(createButton).toBeDisabled();
    const suggestion = page.locator(".suggestions-list button").first();
    const suggestionText = await suggestion.locator("span").first().innerText();
    await suggestion.click();
    await expect(page.getByRole("textbox")).toHaveValue(suggestionText);
    await expect(createButton).toBeEnabled();
    await testInfo.attach("create.png", { body: await page.screenshot(), contentType: "image/png" });

    let generationCount = 0;
    await page.route("**/api/generate", async (route) => {
      generationCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 120));
      await fulfillImage(route);
    });

    await page.getByRole("button", { name: /Create doodle/ }).click();
    await expect(page.getByRole("status")).toContainText("Drawing your doodle...");
    await testInfo.attach("loading.png", { body: await page.screenshot(), contentType: "image/png" });
    await expectNoOverflow(page);
    await expect(page.getByAltText("Generated sticky-note doodle")).toBeVisible();
    await expectNoOverflow(page);
    await testInfo.attach("result.png", { body: await page.screenshot(), contentType: "image/png" });

    await expect(page.getByRole("button", { name: /View larger/ })).toBeVisible();
    await page.getByRole("button", { name: /View larger/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Doodle, up close")).toBeHidden();
    await expect(dialog.getByRole("heading", { name: "A closer look" })).toBeHidden();
    const nativeLink = dialog.getByRole("link", { name: "Open in new tab" });
    await expect(nativeLink).toHaveAttribute("target", "_blank");
    await expect(nativeLink).toHaveAttribute("rel", "noreferrer");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: /Download/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("doodle.png");

    await page.getByRole("button", { name: /Try again/ }).click();
    await expect(page.getByAltText("Generated sticky-note doodle")).toBeVisible();
    expect(generationCount).toBe(2);
    await expectNoOverflow(page);

    await page.getByRole("button", { name: /New scene/ }).click();
    await expect(page.getByRole("textbox")).toHaveValue("");
    await expect(page.getByAltText(/two cats kissing upside down/)).toBeVisible();
    await expectNoOverflow(page);
  });

  test("preserves the scene for refusal, timeout, and temporary errors", async ({ page }, testInfo) => {
    await openTool(page);
    const scenarios = [
      { status: 422, message: "That scene could not be drawn." },
      { status: 504, message: "took too long" },
      { status: 502, message: "could not finish" },
    ];

    for (const scenario of scenarios) {
      await page.route("**/api/generate", async (route) => {
        await route.fulfill({ status: scenario.status, contentType: "application/json", body: "{}" });
      });
      const scene = `A scenario for ${scenario.status}`;
      await page.getByRole("textbox").fill(scene);
      await page.getByRole("button", { name: /Create doodle/ }).click();
      await expect(page.locator(".doodle-stage-error")).toContainText(scenario.message);
      await expect(page.getByRole("textbox")).toHaveValue(scene);
      await expectNoOverflow(page);
      if (scenario.status === 422) {
        await expect(page.locator(".doodle-stage-error")).toHaveCSS("width", "220px");
        await testInfo.attach("error.png", { body: await page.screenshot(), contentType: "image/png" });
      }
      await page.unroute("**/api/generate");
    }
  });

  test("keeps the public composer available if generation is unavailable", async ({ page }) => {
    await openTool(page);
    await page.route("**/api/generate", async (route) => {
      await route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
    });
    await page.getByRole("textbox").fill("A scene that must stay here");
    await page.getByRole("button", { name: /Create doodle/ }).click();
    await expect(page.locator(".doodle-stage-error")).toContainText("temporarily unavailable");
    await expect(page.getByRole("textbox")).toHaveValue("A scene that must stay here");
  });

  test("serves localized pages with matching discovery metadata", async ({ page }) => {
    await page.goto("/de");
    await expect(page.getByRole("heading", { name: "Was sollen wir zeichnen?" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://doodle.samistudio.nl/de");
    await expect(page.locator('link[hreflang="nl"]')).toHaveAttribute("href", "https://doodle.samistudio.nl/nl");

    await page.goto("/ar");
    await expect(page.getByRole("heading", { name: "ماذا نرسم؟" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://doodle.samistudio.nl/ar");
  });
});

test.describe("Task 7 purchase and account QA", () => {
  test("keeps auth actions separated and the narrow sheet in view", async ({ page }, testInfo) => {
    await page.route("**/api/account", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ authenticated: false, email: null, balance: 0, freeRemaining: 0 }),
    }));
    await page.route("**/api/generate", (route) => route.fulfill({
      status: 402,
      contentType: "application/json",
      headers: { "X-Doodle-Free-Remaining": "0" },
      body: JSON.stringify({ error: "payment_required" }),
    }));

    for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 700 }]) {
      await page.setViewportSize(viewport);
      await openTool(page);
      await page.getByRole("textbox").fill("A tiny cat with an umbrella");
      await page.getByRole("button", { name: "Create doodle" }).click();
      await page.getByRole("button", { name: "Get 10 doodles" }).click();
      await expect(page.getByRole("button", { name: "Continue with Google" })).toBeFocused();

      const slip = page.locator(".purchase-slip");
      await slip.evaluate(async (element) => {
        await Promise.all(element.getAnimations().map((animation) => animation.finished));
      });
      const actionBoxes = await page.locator(".purchase-auth > button").evaluateAll((buttons) =>
        buttons.map((button) => {
          const box = button.getBoundingClientRect();
          return { top: box.top, bottom: box.bottom };
        }),
      );
      expect(actionBoxes).toHaveLength(3);
      for (let index = 1; index < actionBoxes.length; index += 1) {
        expect(actionBoxes[index - 1].bottom).toBeLessThanOrEqual(actionBoxes[index].top);
        expect(actionBoxes[index].top - actionBoxes[index - 1].bottom).toBeGreaterThanOrEqual(8);
      }

      const slipBox = await slip.boundingBox();
      expect(slipBox).not.toBeNull();
      expect(slipBox!.y).toBeGreaterThanOrEqual(0);
      expect(slipBox!.y + slipBox!.height).toBeLessThanOrEqual(viewport.height);
      await testInfo.attach(`auth-${viewport.width}x${viewport.height}.png`, {
        body: await page.screenshot(),
        contentType: "image/png",
      });

      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toBeHidden();
    }
  });

  test("returns focus to the delete trigger after Escape", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route("**/api/account", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ authenticated: true, email: "buyer@example.com", balance: 4, freeRemaining: null }),
    }));
    await openTool(page);

    await page.locator(".account-menu summary").click();
    const deleteTrigger = page.getByRole("button", { name: "Delete account" });
    await deleteTrigger.click();
    const dialog = page.getByRole("dialog", { name: "Delete account" });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("button", { name: "Keep account" })).toBeFocused();

    await page.keyboard.press("Escape");

    await expect(dialog).toBeHidden();
    await expect(deleteTrigger).toBeFocused();
  });
});

test.describe("Doodle desktop and accessibility", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("stays centered, one-column, keyboard reachable, and works with reduced motion", async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openTool(page);
    await page.reload();
    const main = page.locator(".doodle-main");
    await expect(main).toHaveCSS("width", "1180px");
    await expect(page.getByRole("heading", { name: "What should we doodle?" })).toBeVisible();
    await expectNoOverflow(page);
    await page.getByRole("textbox").fill("Two cats hug");

    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const focusableSelector = ".doodle-wordmark, .language-switcher summary, textarea, .composer-footer button, .suggestions-list button";
    const controls = page.locator(focusableSelector);
    for (let index = 0; index < await controls.count(); index += 1) {
      await page.keyboard.press("Tab");
      await expect(page.locator(":focus-visible")).toHaveCount(1);
      const focusedIndex = await page.evaluate((selector) => {
        const activeElement = document.activeElement;
        return activeElement
          ? Array.from(document.querySelectorAll(selector)).indexOf(activeElement)
          : -1;
      }, focusableSelector);
      expect(focusedIndex).toBe(index);
    }

    await page.route("**/api/generate", fulfillImage);
    await page.getByRole("button", { name: /Create doodle/ }).click();
    await expect(page.getByAltText("Generated sticky-note doodle")).toBeVisible();
    await testInfo.attach("desktop-result.png", { body: await page.screenshot(), contentType: "image/png" });
    await expectNoOverflow(page);
  });
});
