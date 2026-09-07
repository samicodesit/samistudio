import { expect, test } from "@playwright/test";

for (const width of [320, 1440]) {
  test(`Play purchase uses catalog and server verification at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    let balance = 0;
    let stripeCalls = 0;
    let verified = 0;
    await page.route("**/api/account", route => route.fulfill({ json: { authenticated: true, email: "test@example.com", balance, freeRemaining: null } }));
    await page.route("**/api/generate", route => route.fulfill({ status: 402, json: { error: "payment_required" } }));
    await page.route("**/api/checkout", route => { stripeCalls++; return route.fulfill({ status: 503 }); });
    await page.route("**/api/play/config", route => route.fulfill({ json: { enabled: true, productId: "doodle_credits_10", obfuscatedAccountId: "a".repeat(64) } }));
    await page.route("**/api/play/verify", route => {
      expect(route.request().postDataJSON()).toEqual({ productId: "doodle_credits_10", purchaseToken: "test-play-token-1234567890" });
      verified++;
      balance = 10;
      return route.fulfill({ json: { status: "granted", balance } });
    });
    await page.addInitScript(() => {
      Object.assign(window, {
        getDigitalGoodsService: async () => ({
          getDetails: async () => [{ itemId: "doodle_credits_10", price: { currency: "USD", value: "3.49" } }],
          listPurchases: async () => [],
        }),
        PaymentRequest: class {
          constructor(methods: unknown) { document.documentElement.dataset.playMethods = JSON.stringify(methods); }
          async show() { return { details: { purchaseToken: "test-play-token-1234567890" }, complete: async (value: string) => { document.documentElement.dataset.playComplete = value; } }; }
        },
      });
    });
    await page.goto("/?runtime=play");
    await page.getByLabel("Describe a scene", { exact: true }).fill("A happy dog");
    await page.getByRole("button", { name: "Create doodle", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("3.49");
    await expect(dialog).not.toContainText("€4.99");
    expect(verified).toBe(0);
    await page.screenshot({ path: testInfo.outputPath(`play-offer-${width}.png`) });
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await dialog.getByRole("button", { name: "Get 10 doodles", exact: true }).click();
    await expect(dialog).toContainText("10 doodles added");
    expect(verified).toBe(1);
    expect(stripeCalls).toBe(0);
    const methods = await page.evaluate(() => JSON.parse(document.documentElement.dataset.playMethods!));
    expect(methods[0].data).toEqual({ sku: "doodle_credits_10", obfuscatedAccountId: "a".repeat(64) });
    expect(await page.evaluate(() => document.documentElement.dataset.playComplete)).toBe("success");
  });
}

test("Play runtime does not fall back to Stripe when its API is missing", async ({ page }) => {
  let stripeCalls = 0;
  await page.route("**/api/account", route => route.fulfill({ json: { authenticated: true, email: "test@example.com", balance: 0, freeRemaining: null } }));
  await page.route("**/api/generate", route => route.fulfill({ status: 402, json: { error: "payment_required" } }));
  await page.route("**/api/checkout", route => { stripeCalls++; return route.fulfill({ status: 503 }); });
  await page.goto("/?runtime=play");
  await page.getByLabel("Describe a scene", { exact: true }).fill("A happy dog");
  await page.getByRole("button", { name: "Create doodle", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Get 10 doodles", exact: true })).toBeDisabled();
  await expect(dialog).not.toContainText("€4.99");
  expect(stripeCalls).toBe(0);
  await expect(page).toHaveURL(/runtime=play/);
});
