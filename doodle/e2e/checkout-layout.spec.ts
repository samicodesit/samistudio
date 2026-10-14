import { test, expect } from "@playwright/test";

const QA = process.env.DOODLE_QA_OUTPUT_DIR ?? "test-results/checkout-layout";

const catalog = { offerEnd: "2026-10-31T23:59:59+01:00", packs: [
  { productId: "pack_mini", credits: 6, normalCredits: 6, offerApplied: false, unitAmount: 199, currency: "EUR" },
  { productId: "pack_regular", credits: 25, normalCredits: 20, offerApplied: true, unitAmount: 499, currency: "EUR" },
  { productId: "pack_big", credits: 60, normalCredits: 60, offerApplied: false, unitAmount: 999, currency: "EUR" },
] };

for (const size of [{ name: "desktop", width: 1280, height: 900 }, { name: "mobile", width: 360, height: 640 }]) {
  test(`${size.name}: lean purchase controls fit in every language`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.route("**/api/account", route => route.fulfill({ json: { authenticated: false, email: null, balance: 0, freeRemaining: 0, hasPurchased: false } }));
    await page.route("**/api/checkout/catalog", route => route.fulfill({ json: catalog }));
    await page.route("**/api/checkout/paywall", route => route.fulfill({ json: { accepted: true } }));
    for (const locale of ["en", "nl", "de", "fr", "es", "pt-br", "it", "ja", "ko", "ar"] as const) {
      await page.goto(locale === "en" ? "/" : `/${locale}`);
      await page.locator("textarea").fill("Flower cat");
      await page.locator("#composer .composer-footer > button").click();
      const buy = page.locator(".web-pack-buy");
      await expect(page.locator(".web-pack-currency-note")).toHaveCount(0);
      await expect(page.locator(".web-pack-buy")).toBeEnabled();
      await expect(page.locator(".web-pack-card")).toHaveCount(3);
      const font = await buy.evaluate(async element => {
        await document.fonts.ready;
        const style = getComputedStyle(element);
        const primary = style.fontFamily.split(",")[0];
        return { family: primary, loaded: document.fonts.check(`${style.fontSize} ${primary}`, element.textContent ?? ""), faceLoaded: Array.from(document.fonts).some(face => primary.includes(face.family) && face.status === "loaded") };
      });
      expect(font.family).toContain(locale === "ar" ? "Alexandria" : "IBM Plex Sans");
      expect(font.loaded).toBe(true);
      expect(font.faceLoaded).toBe(true);
      for (const selector of [".web-pack-buy", ".web-pack-dismiss"]) {
        const box = await page.locator(selector).boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(size.width);
        expect(box!.y).toBeGreaterThanOrEqual(0);
        expect(box!.y + box!.height).toBeLessThanOrEqual(size.height);
      }
      if (locale === "en" || (locale === "ar" && size.name === "mobile")) {
        await page.screenshot({ path: `${QA}/${size.name}-${locale}.png` });
      }
      if (locale === "en" && size.name === "mobile") {
        await page.addStyleTag({ content: ".web-pack-dialog p,.web-pack-dialog button,.web-pack-dialog span{font-size:26px!important}.web-pack-heading h2{font-size:42px!important}" });
        for (const selector of [".web-pack-buy", ".web-pack-dismiss"]) {
          const box = await page.locator(selector).boundingBox();
          expect(box!.y).toBeGreaterThanOrEqual(0);
          expect(box!.y + box!.height).toBeLessThanOrEqual(size.height);
        }
        await page.screenshot({ path: `${QA}/mobile-large-text.png` });
      }
      await page.locator(".web-pack-dismiss").click();
    }
  });
}

test("purchase dialog contains scrolling and restores the page on dismissal", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.route("**/api/account", route => route.fulfill({ json: { authenticated: false, email: null, balance: 0, freeRemaining: 0, hasPurchased: false } }));
  await page.route("**/api/checkout/catalog", route => route.fulfill({ json: catalog }));
  await page.route("**/api/checkout/paywall", route => route.fulfill({ json: { accepted: true } }));
  await page.goto("/");
  const pageWidth = await page.evaluate(() => document.documentElement.clientWidth);
  await page.locator("textarea").fill("Flower cat");
  await page.locator("#composer .composer-footer > button").click();
  await expect(page.locator(".web-pack-card")).toHaveCount(3);
  const original = await page.evaluate(() => ({ y: scrollY, width: document.documentElement.clientWidth }));
  expect(original.width).toBe(pageWidth);
  await page.locator(".web-pack-heading h2").press("PageDown");
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(original.y);
  await page.mouse.move(10, 350);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => scrollY)).toBe(original.y);

  // Enlarge real content to exercise the overflow fallback without a payment SDK.
  await page.addStyleTag({ content: ".web-pack-card span{font-size:26px!important}" });
  const pane = page.locator(".web-pack-scroll");
  expect(await pane.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
  await pane.hover();
  await page.mouse.wheel(0, 500);
  await expect.poll(() => pane.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => scrollY)).toBe(original.y);
  await page.locator(".web-pack-dismiss").click();
  await expect(page.locator(".web-pack-dialog")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.clientWidth)).toBe(original.width);
  await page.mouse.move(10, 350);
  await page.mouse.wheel(0, 500);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(original.y);
});

test("desktop wallet container fits without a phantom scrollbar", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.route("**/api/account", route => route.fulfill({ json: { authenticated: false, email: null, balance: 0, freeRemaining: 0, hasPurchased: false } }));
  await page.route("**/api/checkout/catalog", route => route.fulfill({ json: catalog }));
  await page.route("**/api/checkout/paywall", route => route.fulfill({ json: { accepted: true } }));
  await page.goto("/");
  await page.locator("textarea").fill("Flower cat");
  await page.locator("#composer .composer-footer > button").click();
  await expect(page.locator(".web-pack-card")).toHaveCount(3);
  // Layout fixture only. Stripe's rendered wrapper has 4px negative block margins.
  await page.locator(".web-pack-scroll").evaluate(element => {
    const wallet = document.createElement("div");
    wallet.className = "purchase-apple-pay purchase-apple-pay-available";
    wallet.innerHTML = '<div class="purchase-wallet-pricing"><p class="purchase-wallet-total">Apple Pay total<strong>€4.99 EUR</strong></p></div><div style="height:56px;margin:-4px 0"><div style="height:48px;margin:4px;border:1px solid black;border-radius:6px"></div></div>';
    element.append(wallet);
  });
  const oldSpacing = await page.addStyleTag({ content: ".web-pack-scroll:has(.purchase-apple-pay-available .purchase-wallet-total){padding-bottom:0}" });
  expect(await page.locator(".web-pack-scroll").evaluate(element => element.scrollHeight - element.clientHeight)).toBeGreaterThan(1);
  await oldSpacing.evaluate(element => element.parentNode?.removeChild(element));
  expect(await page.locator(".web-pack-scroll").evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
});
