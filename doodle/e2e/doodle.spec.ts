import { getComposerIntro } from "../src/lib/composer-intro";
import { getPackCopy,fillPackText } from "../src/lib/pack-copy";
import { expect, test, type Locator, type Page, type Route } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const referencePng = fs.readFileSync(path.join(process.cwd(), "public/references/doodle-reference-kiss.png"));

async function openTool(page: Page, path = "/") {
  await page.goto(path);
  await expect(page.getByRole("heading", { name: getComposerIntro("en").title })).toBeVisible();
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

async function expectResultActionHierarchy(page: Page, newSceneLabel: string, redrawLabel: string) {
  const actions = page.locator(".secondary-actions");
  const newScene = page.getByRole("button", { name: newSceneLabel, exact: true });
  const redraw = page.getByRole("button", { name: redrawLabel, exact: true });
  const more = page.locator(".result-more-button");
  await expect(redraw).toBeHidden();
  await expect(page.locator(".report-action")).toBeHidden();
  const [actionsBox, newSceneBox, moreBox] = await Promise.all([
    actions.boundingBox(), newScene.boundingBox(), more.boundingBox(),
  ]);
  expect(actionsBox).not.toBeNull();
  expect(newSceneBox).not.toBeNull();
  expect(moreBox).not.toBeNull();
  expect(newSceneBox!.width).toBeGreaterThan(moreBox!.width);
  expect(Math.abs(newSceneBox!.y - moreBox!.y)).toBeLessThanOrEqual(1);
  expect(moreBox!.width).toBeGreaterThanOrEqual(48);
  expect(moreBox!.height).toBeGreaterThanOrEqual(48);
  await expect(newScene).toHaveCSS("font-weight", "500");
  await expect(page.locator(".doodle-stage-result")).toHaveCSS("transform", "none");
  await expect(page.locator(".stage-inspect-label svg")).toBeVisible();
  await expect(page.locator(".stage-inspect-label")).toHaveText("");
  await more.click();
  await expect(page.locator(".result-options-dialog")).toBeVisible();
  await expect(redraw).toBeVisible();
  await expect(page.locator(".report-action")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".result-options-dialog")).toBeHidden();
  await expect(more).toBeFocused();
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/account",route=>route.fulfill({json:{authenticated:false,email:null,balance:0,freeRemaining:4,hasPurchased:false}}));
  await page.route("**/api/checkout/catalog",route=>route.fulfill({json:{offerEnd:"2026-10-31T23:59:59+01:00",packs:[{productId:"pack_mini",credits:6,normalCredits:6,offerApplied:false,unitAmount:199,currency:"EUR"},{productId:"pack_regular",credits:25,normalCredits:20,offerApplied:true,unitAmount:499,currency:"EUR"},{productId:"pack_big",credits:60,normalCredits:60,offerApplied:false,unitAmount:999,currency:"EUR"}]}}));
});

test.describe("Doodle mobile workflow", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("offers sharing and a usable manual fallback on a narrow screen", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
      Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    });
    await page.route("**/api/generate", fulfillImage);
    await openTool(page);
    await page.getByRole("textbox").fill("A cat holding a heart");
    await page.getByRole("button", { name: "Create doodle", exact: true }).click();
    await page.getByRole("button", { name: "Share doodle", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Link to Doodle" })).toHaveValue("https://doodle.samistudio.nl/?utm_source=doodle&utm_medium=share&utm_campaign=made_with_doodle");
    await expect(page.getByRole("status")).toContainText("Copy this link");
    await expectNoOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("share-mobile.png"), fullPage: true });
  });

  test("creates, downloads, retries, and starts a new scene", async ({ page }, testInfo) => {
    await openTool(page);
    await page.reload();
    await expect(page.getByRole("heading", { name: getComposerIntro("en").title })).toBeVisible();
    await expectNoOverflow(page);
    await expectSuggestionsFit(page);

    await expect(page.locator(".doodle-stage-reference")).toBeHidden();

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
      await new Promise((resolve) => setTimeout(resolve, 700));
      await fulfillImage(route);
    });

    await page.getByRole("button", { name: /Create doodle/ }).click();
    await expect(page.locator(".doodle-stage-loading")).toBeVisible();
    await expect(page.locator(".loading-message")).not.toBeEmpty();
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

    await page.getByRole("button", { name: "More options" }).click();
    await page.getByRole("button", { name: /Redraw this idea/ }).click();
    await expect(page.getByAltText("Generated sticky-note doodle")).toBeVisible();
    expect(generationCount).toBe(2);
    await expectNoOverflow(page);

    await page.getByRole("button", { name: /Draw something else/ }).click();
    await expect(page.getByRole("textbox")).toHaveValue("");
    await expect(page.getByRole("textbox")).toBeFocused();
    await expect(page.getByRole("button",{name:/Create doodle/})).toBeDisabled();
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
        const errorBox=await page.locator(".doodle-stage-error").boundingBox();expect(errorBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
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
    await expect(page.getByRole("heading", { name:getComposerIntro("de").title })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://doodle.samistudio.nl/de");
    await expect(page.locator('link[hreflang="nl"]')).toHaveAttribute("href", "https://doodle.samistudio.nl/nl");

    await page.goto("/ar");
    await expect(page.getByRole("heading", { name:getComposerIntro("ar").title })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://doodle.samistudio.nl/ar");
  });
});

test.describe("Task 7 purchase and account QA", () => {
  test("shares the site origin with cross-origin sign-in providers", async ({ page }) => {
    const response = await page.goto("/");

    expect(response?.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  test("allows cross-origin sign-in popups to message their opener", async ({ page }) => {
    const response = await page.goto("/");

    expect(response?.headers()["cross-origin-opener-policy"]).toBe("same-origin-allow-popups");
  });

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
      const slip = page.locator(".web-pack-dialog");
      await expectFullyInViewport(page, slip);
      await expect(slip).toHaveCSS("animation-name", "none");
      await testInfo.attach(`offer-${viewport.width}x${viewport.height}.png`, {
        body: await page.screenshot(),
        contentType: "image/png",
      });
      await expect(page.locator("#web-pack-title")).toBeFocused();
      await page.getByRole("button", { name: /Get 25 doodles/ }).click();
      await expect(page.locator(".google-sign-in")).toBeVisible();
      await expect(page.getByRole("button", { name: "Not now" })).toBeVisible();

      await expectFullyInViewport(page, slip);
      const actionBoxes = await page.locator(".web-pack-footer > button").evaluateAll((buttons) =>
        buttons.map((button) => {
          const box = button.getBoundingClientRect();
          return { top: box.top, bottom: box.bottom };
        }),
      );
      expect(actionBoxes).toHaveLength(1);
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
    await expect(page.getByRole("button", { name: "Get more",exact:true })).toBeFocused();
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

  test("keeps the scene through four free doodles, a refunded failure, and the purchase gate", async ({ page }, testInfo) => {
    await page.route("**/api/account", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ authenticated: false, email: null, balance: 0, freeRemaining: 4 }),
    }));
    let generationCount = 0;
    await page.route("**/api/generate", async (route) => {
      generationCount++;
      const remaining=generationCount===1||generationCount===2?3:generationCount===3?2:generationCount===4?1:0;
      await route.fulfill({status:generationCount===2?502:200,contentType:generationCount===2?"application/json":"image/png",headers:{"X-Doodle-Free-Remaining":String(remaining)},body:generationCount===2?Buffer.from("{}"):referencePng});
    });
    await openTool(page);
    await page.getByRole("textbox").fill("A cat under an umbrella");
    await page.getByRole("button", { name: "Create doodle" }).click();
    await expect(page.getByText("3 free doodles left")).toBeVisible();
    await page.getByRole("button", { name: "More options" }).click();
    await page.getByRole("button", { name: "Redraw this idea" }).click();
    await expect(page.locator(".doodle-stage-error")).toContainText("could not finish");
    await expect(page.getByRole("textbox")).toHaveValue("A cat under an umbrella");
    await expect(page.getByText("3 free doodles left")).toBeVisible();
    await page.getByRole("button", { name: "Create doodle" }).click();
    await expect(page.getByText("2 free doodles left")).toBeVisible();
    for(const remaining of [1,0]){
      await page.getByRole("button", { name: "More options" }).click();
      await page.getByRole("button", { name: "Redraw this idea" }).click();
      await expect(page.getByText(`${remaining} free ${remaining===1?"doodle":"doodles"} left`)).toBeVisible();
    }
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("That was your last free doodle.")).toBeVisible();
    await page.getByRole("button", { name: "Get more",exact:true }).click();
    await expect(page.getByRole("dialog", { name: "Keep doodling" })).toBeVisible();
    expect(generationCount).toBe(5);
    await page.keyboard.press("Escape");
    await expect(page.getByAltText("Generated sticky-note doodle")).toBeVisible();
    await page.getByRole("button", { name: "Draw something else" }).click();
    await page.getByRole("textbox").fill("A cat under an umbrella");
    await page.getByRole("button", { name: "Create doodle" }).click();
    await expect(page.getByRole("dialog", { name: "Keep doodling" })).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveValue("A cat under an umbrella");
    expect(generationCount).toBe(5);
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
      body: JSON.stringify({ url: "https://checkout.stripe.com/c/pay/cancel_fixture" }),
    }));
    await page.route("https://checkout.stripe.com/c/pay/cancel_fixture", route=>route.fulfill({status:302,headers:{location:"http://127.0.0.1:3100/?checkout=cancelled"}}));
    await openTool(page);
    await page.getByRole("textbox").fill("A kite above the sea");
    await page.getByRole("button", { name: "Create doodle" }).click();
    await Promise.all([
      page.waitForURL((url) => url.searchParams.get("checkout") === "cancelled", { waitUntil: "commit" }),
      page.getByRole("button", { name: /Get 25 doodles/ }).click(),
    ]);
    await expect(page).toHaveURL("http://127.0.0.1:3100/");
    await expect(page.getByRole("textbox")).toHaveValue("A kite above the sea");

    await page.addInitScript(() => {
      sessionStorage.setItem("doodle:return", JSON.stringify({ scene: "A kite above the sea", intent: "checkout" }));
    });
    await page.route("**/api/checkout/confirm", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ balance: 25,productId:"pack_regular",creditsGranted:25,offerApplied:true }),
    }));
    await page.goto("/?checkout=cs_paid");
    await expect(page.getByText("Added 25 doodles",{exact:true})).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("textbox")).toHaveValue("A kite above the sea");

    await page.unroute("**/api/generate");
    await page.route("**/api/generate", (route) => route.fulfill({
      status: 200,
      contentType: "image/png",
      headers: { "X-Doodle-Paid-Remaining": "24" },
      body: referencePng,
    }));
    await page.getByRole("button", { name: "Create doodle" }).click();
    await expect(page.locator(".workspace-usage > span")).toHaveText("24 doodles left");
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
    await expect(page.getByRole("heading", { name:getComposerIntro("ar").title })).toBeVisible();
    await page.getByRole("textbox").fill("قطة تحت مظلة");
    await page.getByRole("button", { name: "أنشئ رسمة" }).click();
    const dialog = page.getByRole("dialog", { name: "واصل الرسم" });
    const slip = page.locator(".web-pack-dialog");
    await expectFullyInViewport(page, slip);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expectNoOverflow(page);
    await testInfo.attach("arabic-offer-390x844.png", { body: await page.screenshot(), contentType: "image/png" });

    await page.getByRole("button", { name:fillPackText(getPackCopy("ar").buy,{count:25,price:new Intl.NumberFormat("ar",{style:"currency",currency:"EUR"}).format(4.99)}) }).click();
    await expect(page.locator(".google-sign-in")).toBeVisible();
    await expect(page.locator("#web-pack-title")).toBeFocused();
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
      body: JSON.stringify({ balance: 25,productId:"pack_regular",creditsGranted:25,offerApplied:true }),
    }));
    await page.goto("/ar?checkout=cs_ar_paid");
    await expect(page.getByText(fillPackText(getPackCopy("ar").added,{count:25}),{exact:true})).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expectNoOverflow(page);
    await testInfo.attach("arabic-success-390x844.png", { body: await page.screenshot(), contentType: "image/png" });
  });
});

test.describe("Doodle desktop and accessibility", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("keeps the corrected result actions clear across desktop, narrow mobile, German, and Arabic", async ({ page }) => {
    await page.route("**/api/generate", fulfillImage);
    const screenshotDirectory = path.join(process.cwd(), "test-results");
    fs.mkdirSync(screenshotDirectory, { recursive: true });
    const cases = [
      { path: "/", width: 1440, height: 1000, newScene: "Draw something else", redraw: "Redraw this idea", screenshot: "result-actions-en-desktop-1440x1000.png" },
      { path: "/", width: 320, height: 740, newScene: "Draw something else", redraw: "Redraw this idea", screenshot: "result-actions-en-mobile-320x740.png" },
      { path: "/de", width: 390, height: 844, newScene: "Etwas anderes zeichnen", redraw: "Diese Idee neu zeichnen", screenshot: "result-actions-de-mobile-390x844.png" },
      { path: "/ar", width: 390, height: 844, newScene: "ارسم شيئًا آخر", redraw: "أعد رسم هذه الفكرة", screenshot: "result-actions-ar-mobile-390x844.png" },
    ];

    for (const item of cases) {
      await page.setViewportSize({ width: item.width, height: item.height });
      await page.goto(item.path);
      await page.getByRole("textbox").fill("A small cat holding a heart");
      await page.locator(".composer-footer > button").click();
      await expect(page.locator(".doodle-workspace-ready")).toBeVisible();
      await expectResultActionHierarchy(page, item.newScene, item.redraw);
      await expectNoOverflow(page);
      await page.screenshot({ path: path.join(screenshotDirectory, item.screenshot), fullPage: true });
    }
  });

  test("stays centered, one-column, keyboard reachable, and works with reduced motion", async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openTool(page);
    await page.reload();
    const main = page.locator(".doodle-main");
    const mainBox=await main.boundingBox();expect(mainBox!.width).toBeLessThanOrEqual(1440);expect(mainBox!.x).toBeGreaterThanOrEqual(0);
    await expect(page.getByRole("heading", { name: getComposerIntro("en").title })).toBeVisible();
    await expectNoOverflow(page);
    await page.getByRole("textbox").fill("Two cats hug");

    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const required=[page.locator(".account-sign-in-action"),page.getByRole("radio",{name:"Simple",exact:true}),page.getByRole("textbox"),page.getByRole("button",{name:"Use a photo"}),page.getByRole("button",{name:"Create doodle"})];
    const seen=new Set<number>();
    for(let index=0;index<24&&seen.size<required.length;index++){
      await page.keyboard.press("Tab");
      await expect(page.locator(":focus-visible")).toHaveCount(1);
      for(let control=0;control<required.length;control++)if(await required[control].evaluate(element=>element===document.activeElement))seen.add(control);
    }
    expect(seen.size).toBe(required.length);

    await page.route("**/api/generate", fulfillImage);
    await page.getByRole("button", { name: /Create doodle/ }).click();
    await expect(page.getByAltText("Generated sticky-note doodle")).toBeVisible();
    await testInfo.attach("desktop-result.png", { body: await page.screenshot(), contentType: "image/png" });
    await expectNoOverflow(page);
  });
});
