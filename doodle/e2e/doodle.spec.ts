import { expect, test, type Page, type Route } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const referencePng = fs.readFileSync(path.join(process.cwd(), "public/references/doodle-reference-kiss.png"));

async function unlock(page: Page) {
  await page.goto("/");
  const passphrase = page.getByRole("textbox", { name: "Passphrase" });
  if (await passphrase.isVisible().catch(() => false)) {
    await passphrase.fill("test-passphrase");
    await page.getByRole("button", { name: "Unlock" }).click();
  }
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

test.describe("Doodle mobile workflow", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("unlocks, creates, downloads, retries, and starts a new scene", async ({ page }, testInfo) => {
    await unlock(page);
    await page.reload();
    await expect(page.getByRole("heading", { name: "What should we doodle?" })).toBeVisible();
    await expectNoOverflow(page);

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
    await expect(dialog.getByRole("button", { name: /View at 100%/ })).toBeVisible();
    await dialog.getByRole("button", { name: /View at 100%/ }).click();
    await expect(dialog).toHaveAttribute("data-view", "native");
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

  test("shows the incorrect passphrase message", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("textbox", { name: "Passphrase" }).fill("nope");
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(page.getByText("That passphrase is not correct.")).toBeVisible();
  });

  test("preserves the scene for refusal, timeout, and temporary errors", async ({ page }, testInfo) => {
    await unlock(page);
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
        await testInfo.attach("error.png", { body: await page.screenshot(), contentType: "image/png" });
      }
      await page.unroute("**/api/generate");
    }
  });

  test("returns to the composer after a session expiry without losing the scene", async ({ page }) => {
    await unlock(page);
    await page.route("**/api/generate", async (route) => {
      await route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
    });
    await page.getByRole("textbox").fill("A scene that must stay here");
    await page.getByRole("button", { name: /Create doodle/ }).click();
    await expect(page.getByRole("heading", { name: "Enter the passphrase" })).toBeVisible();
    await page.getByRole("textbox", { name: "Passphrase" }).fill("test-passphrase");
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(page.getByRole("textbox")).toHaveValue("A scene that must stay here");
  });
});

test.describe("Doodle desktop and accessibility", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("stays centered, one-column, keyboard reachable, and works with reduced motion", async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await unlock(page);
    await page.reload();
    const main = page.locator(".doodle-main");
    await expect(main).toHaveCSS("width", "1180px");
    await expect(page.getByRole("heading", { name: "What should we doodle?" })).toBeVisible();
    await expectNoOverflow(page);
    await page.getByRole("textbox").fill("Two cats hug");

    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const focusableSelector = ".doodle-wordmark, textarea, .composer-footer button, .suggestions-list button";
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
