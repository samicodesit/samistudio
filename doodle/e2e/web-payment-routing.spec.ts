import { expect, test } from "@playwright/test";

const packsEnabled = process.env.PLAYWRIGHT_WEB_PACKS_ENABLED !== "false";
const stripeUrl = "https://checkout.stripe.com/c/pay/routing_test";
const catalog = {
  offerEnd: "2026-10-31T23:59:59+01:00",
  packs: [
    { productId: "pack_mini", credits: 6, normalCredits: 6, offerApplied: false, unitAmount: 199, currency: "EUR" },
    { productId: "pack_regular", credits: 25, normalCredits: 20, offerApplied: true, unitAmount: 499, currency: "EUR" },
    { productId: "pack_big", credits: 60, normalCredits: 60, offerApplied: false, unitAmount: 999, currency: "EUR" },
  ],
};

for (const width of [360, 1280]) {
  for (const scenario of ["exposed-api", "copied-play-url", "stale-play-marker"] as const) {
    test(`${width}px ${scenario}: browser checkout stays on Stripe`, async ({ page }) => {
      await page.setViewportSize({ width, height: 640 });
      let checkoutCalls = 0;
      let playCalls = 0;
      await page.route("**/api/account", route => route.fulfill({ json: { authenticated: true, email: "qa@example.test", balance: 0, freeRemaining: 0, hasPurchased: true } }));
      await page.route("**/api/checkout/catalog", route => route.fulfill({ json: catalog }));
      await page.route("**/api/checkout/paywall", route => route.fulfill({ json: { accepted: true } }));
      await page.route("**/api/play/**", route => { playCalls++; return route.fulfill({ status: 503 }); });
      await page.route("**/api/checkout", route => {
        checkoutCalls++;
        if (packsEnabled) expect(route.request().postDataJSON()).toEqual({ locale: "en", productId: "pack_regular", expectedCredits: 25 });
        return route.fulfill({ json: { url: stripeUrl } });
      });
      // Simulate only the provider destination. This test does not make a payment.
      await page.route(stripeUrl, route => route.fulfill({ contentType: "text/html", body: "<h1>Simulated Stripe destination</h1>" }));
      await page.addInitScript(stale => {
        if (stale) sessionStorage.setItem("doodle:play-runtime", "1");
        Object.assign(window, {
          getDigitalGoodsService: () => { throw new Error("Google Play is unavailable in this browser"); },
        });
      }, scenario === "stale-play-marker");
      await page.goto(scenario === "copied-play-url" ? "/?runtime=play" : "/");
      await page.getByRole("textbox").fill("A cat holding a flower");
      await page.getByRole("button", { name: "Create doodle", exact: true }).click();
      const buy = page.getByRole("button", { name: packsEnabled ? /Get 25 doodles/ : "Get 10 doodles", exact: !packsEnabled });
      await expect(buy).toBeEnabled();
      const bounds = await buy.boundingBox();
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(640);
      await buy.click();
      await expect(page).toHaveURL(stripeUrl);
      expect(checkoutCalls).toBe(1);
      expect(playCalls).toBe(0);
    });
  }
}
