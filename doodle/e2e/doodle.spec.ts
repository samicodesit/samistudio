import { expect, test, type Locator, type Page, type Route } from "@playwright/test";
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

async function expectFullyInViewport(page: Page, locator: Locator) {
  await locator.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished));
  });
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
}

async function expectSuggestionsFit(page: Page) {
  const suggestions = page.locator(".suggestions-list");
  const fits = await suggestions.evaluate((element) => element.scrollWidth <= element.clientWidth);
  expect(fits).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/account", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ authenticated: false, email: null, balance: 0, freeRemaining: 2 }),
  }));
});

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
  test("keeps the reduced-motion offer and auth sheet contained at launch sizes", async ({ page }, testInfo) => {
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

    for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 700 }, { width: 1440, height: 1000 }]) {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await openTool(page);
      await page.getByRole("textbox").fill("A tiny cat with an umbrella");
      await page.getByRole("button", { name: "Create doodle" }).click();
      const slip = page.locator(".purchase-slip");
      await expectFullyInViewport(page, slip);
      await expect(slip).toHaveCSS("animation-name", "none");
      await testInfo.attach(`offer-${viewport.width}x${viewport.height}.png`, {
        body: await page.screenshot(),
        contentType: "image/png",
      });
      await expect(page.getByRole("button", { name: "Get 10 doodles" })).toBeFocused();
      await page.getByRole("button", { name: "Get 10 doodles" }).click();
      await expect(page.getByRole("button", { name: "Continue with Google" })).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(page.getByRole("button", { name: "Not now" })).toBeFocused();

      await expectFullyInViewport(page, slip);
      const actionBoxes = await page.locator(".purchase-auth > button").evaluateAll((buttons) =>
        buttons.map((button) => {
          const box = button.getBoundingClientRect();
          return { top: box.top, bottom: box.bottom };
        }),
      );
      expect(actionBoxes).toHaveLength(2);
      for (let index = 1; index < actionBoxes.length; index += 1) {
        expect(actionBoxes[index - 1].bottom).toBeLessThanOrEqual(actionBoxes[index].top);
        expect(actionBoxes[index].top - actionBoxes[index - 1].bottom).toBeGreaterThanOrEqual(8);
      }

      await testInfo.attach(`auth-${viewport.width}x${viewport.height}.png`, {
        body: await page.screenshot(),
        contentType: "image/png",
      });

      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toBeHidden();
    }
  });

  test("reaches and activates account deletion controls by keyboard", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route("**/api/account", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ authenticated: true, email: "buyer@example.com", balance: 4, freeRemaining: null }),
    }));
    await openTool(page);

    const accountTrigger = page.locator(".account-menu summary");
    await expect(accountTrigger).toBeVisible();
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    for (let index = 0; index < 10 && !(await accountTrigger.evaluate((element) => element === document.activeElement)); index += 1) {
      await page.keyboard.press("Tab");
    }
    await expect(accountTrigger).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Sign out" })).toBeFocused();
    await page.keyboard.press("Tab");
    const deleteTrigger = page.getByRole("button", { name: "Delete account" });
    await expect(deleteTrigger).toBeFocused();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Delete account" });
    await expect(dialog).toBeVisible();
    const keepAccount = page.getByRole("button", { name: "Keep account" });
    const deletePermanently = page.getByRole("button", { name: "Delete permanently" });
    await expect(keepAccount).toBeFocused();
    for (let index = 0; index < 4 && !(await deletePermanently.evaluate((element) => element === document.activeElement)); index += 1) {
      await page.keyboard.press("Tab");
    }
    await expect(deletePermanently).toBeFocused();
    for (let index = 0; index < 4 && !(await keepAccount.evaluate((element) => element === document.activeElement)); index += 1) {
      await page.keyboard.press("Shift+Tab");
    }
    await expect(keepAccount).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();
    await expect(deleteTrigger).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(deleteTrigger).toBeFocused();
  });
});

test.describe("Task 8 monetized workflow", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps the scene through two free doodles, a refunded failure, and the purchase gate", async ({ page }, testInfo) => {
    await page.route("**/api/account", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ authenticated: false, email: null, balance: 0, freeRemaining: 2 }),
    }));
    let generationCount = 0;
    await page.route("**/api/generate", async (route) => {
      generationCount += 1;
      if (generationCount === 1) {
        await route.fulfill({ status: 200, contentType: "image/png", headers: { "X-Doodle-Free-Remaining": "1" }, body: referencePng });
      } else if (generationCount === 2) {
        await route.fulfill({ status: 502, contentType: "application/json", headers: { "X-Doodle-Free-Remaining": "1" }, body: "{}" });
      } else if (generationCount === 3) {
        await route.fulfill({ status: 200, contentType: "image/png", headers: { "X-Doodle-Free-Remaining": "0" }, body: referencePng });
      } else {
        await route.fulfill({ status: 402, contentType: "application/json", headers: { "X-Doodle-Free-Remaining": "0" }, body: JSON.stringify({ error: "payment_required" }) });
      }
    });

    await openTool(page);
    await page.getByRole("textbox").fill("A cat under an umbrella");
    await page.getByRole("button", { name: "Create doodle" }).click();
    await expect(page.getByText("1 free doodle left")).toBeVisible();

    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.locator(".doodle-stage-error")).toContainText("could not finish");
    await expect(page.getByRole("textbox")).toHaveValue("A cat under an umbrella");
    await expect(page.getByText("1 free doodle left")).toBeVisible();

    await page.getByRole("button", { name: "Create doodle" }).click();
    await expect(page.getByText("0 free doodles left")).toBeVisible();
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("dialog", { name: "Keep doodling" })).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveValue("A cat under an umbrella");
    await expectNoOverflow(page);
    await testInfo.attach("task-8-mobile-gate.png", { body: await page.screenshot(), contentType: "image/png" });
  });

  test("restores a cancelled Checkout scene and spends confirmed paid credit", async ({ page }, testInfo) => {
    await page.route("**/api/account", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ authenticated: true, email: "buyer@example.com", balance: 0, freeRemaining: null }),
    }));
    await page.route("**/api/generate", (route) => route.fulfill({
      status: 402,
      contentType: "application/json",
      headers: { "X-Doodle-Paid-Remaining": "0" },
      body: JSON.stringify({ error: "payment_required" }),
    }));
    await page.route("**/api/checkout", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ url: "/?checkout=cancelled" }),
    }));
    await openTool(page);
    await page.getByRole("textbox").fill("A kite above the sea");
    await page.getByRole("button", { name: "Create doodle" }).click();
    await Promise.all([
      page.waitForURL((url) => url.searchParams.get("checkout") === "cancelled", { waitUntil: "commit" }),
      page.getByRole("button", { name: "Get 10 doodles" }).click(),
    ]);
    await expect(page).toHaveURL("http://127.0.0.1:3100/");
    await expect(page.getByRole("textbox")).toHaveValue("A kite above the sea");

    await page.addInitScript(() => {
      sessionStorage.setItem("doodle:return", JSON.stringify({ scene: "A kite above the sea", intent: "checkout" }));
    });
    await page.route("**/api/checkout/confirm", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ balance: 10 }),
    }));
    await page.goto("/?checkout=cs_paid");
    await expect(page.getByRole("dialog", { name: "10 doodles added" })).toBeVisible();
    await page.getByRole("button", { name: "Start drawing" }).click();
    await expect(page.getByRole("textbox")).toHaveValue("A kite above the sea");

    await page.unroute("**/api/generate");
    await page.route("**/api/generate", (route) => route.fulfill({
      status: 200,
      contentType: "image/png",
      headers: { "X-Doodle-Paid-Remaining": "9" },
      body: referencePng,
    }));
    await page.getByRole("button", { name: "Create doodle" }).click();
    await expect(page.locator(".workspace-usage > span")).toHaveText("9 doodles left");
    await expectNoOverflow(page);
    await testInfo.attach("task-8-mobile-paid.png", { body: await page.screenshot(), contentType: "image/png" });
  });

  test("fully contains Arabic offer, auth, account, and success states", async ({ page }, testInfo) => {
    let account = { authenticated: false, email: null as string | null, balance: 0, freeRemaining: 0 as number | null };
    await page.route("**/api/account", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(account),
    }));
    await page.route("**/api/generate", (route) => route.fulfill({
      status: 402,
      contentType: "application/json",
      headers: { "X-Doodle-Free-Remaining": "0" },
      body: JSON.stringify({ error: "payment_required" }),
    }));
    await page.goto("/ar");
    await expect(page.getByRole("heading", { name: "ماذا نرسم؟" })).toBeVisible();
    await page.getByRole("textbox").fill("قطة تحت مظلة");
    await page.getByRole("button", { name: "أنشئ رسمة" }).click();
    const dialog = page.getByRole("dialog", { name: "واصل الرسم" });
    const slip = page.locator(".purchase-slip");
    await expectFullyInViewport(page, slip);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expectNoOverflow(page);
    await testInfo.attach("arabic-offer-390x844.png", { body: await page.screenshot(), contentType: "image/png" });

    await page.getByRole("button", { name: "احصل على 10 رسومات" }).click();
    await expect(page.getByRole("button", { name: "المتابعة باستخدام جوجل" })).toBeFocused();
    await expect(page.getByRole("button", { name: "المتابعة بالبريد الإلكتروني" })).toHaveCount(0);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "ليس الآن" })).toBeFocused();
    await expectFullyInViewport(page, slip);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    account = { authenticated: true, email: "buyer@example.com", balance: 4, freeRemaining: null };
    await page.goto("/ar");
    const accountTrigger = page.locator(".account-menu summary");
    await expect(accountTrigger).toBeVisible();
    await expectFullyInViewport(page, accountTrigger);
    await accountTrigger.click();
    const accountPopover = page.locator(".account-popover");
    await expect(accountPopover).toContainText("تبقّت لك 4 رسومات");
    await expectFullyInViewport(page, accountPopover);
    await expectNoOverflow(page);

    await page.evaluate(() => sessionStorage.setItem("doodle:return", JSON.stringify({ scene: "قطة تحت مظلة", intent: "checkout" })));
    await page.route("**/api/checkout/confirm", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ balance: 10 }),
    }));
    await page.goto("/ar?checkout=cs_ar_paid");
    await expect(page.getByRole("dialog", { name: "تمت إضافة 10 رسومات" })).toBeVisible();
    await expectFullyInViewport(page, slip);
    await expectNoOverflow(page);
    await testInfo.attach("arabic-success-390x844.png", { body: await page.screenshot(), contentType: "image/png" });
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
