import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 320, height: 844 } });
test.skip(process.env.PLAYWRIGHT_WEB_PACKS_ENABLED !== "true", "Requires the three-pack checkout feature flag");

for (const purchase of [
  { name: "Mini", index: 0, productId: "pack_mini", credits: 6, price: "€1.99" },
  { name: "Regular", index: 1, productId: "pack_regular", credits: 20, price: "€4.99" },
  { name: "Big", index: 2, productId: "pack_big", credits: 60, price: "€9.99" },
  { name: "Regular bonus", index: 1, productId: "pack_regular", credits: 25, price: "€4.99" },
]) {
  test(`${purchase.name} promises the displayed quantity and preserves the draft if checkout fails`, async ({ page }) => {
    const scene = "A little cat holding a flower";
    let checkoutBody: unknown;
    await page.route("**/api/account", route => route.fulfill({ json: {
      authenticated: true, email: "buyer@example.test", balance: 0, freeRemaining: 0,
    } }));
    await page.route("**/api/generate", route => route.fulfill({ status: 402, json: { error: "payment_required" } }));
    await page.route("**/api/checkout/catalog", route => route.fulfill({ json: {
      offerEnd: "2030-01-01T00:00:00.000Z",
      packs: [
        { productId: "pack_mini", currency: "EUR", unitAmount: 199, normalCredits: 6, credits: 6, offerApplied: false },
        { productId: "pack_regular", currency: "EUR", unitAmount: 499, normalCredits: 20, credits: purchase.credits === 25 ? 25 : 20, offerApplied: purchase.credits === 25 },
        { productId: "pack_big", currency: "EUR", unitAmount: 999, normalCredits: 60, credits: 60, offerApplied: false },
      ],
    } }));
    await page.route("**/api/checkout", route => {
      checkoutBody = route.request().postDataJSON();
      return route.fulfill({ status: 503, json: { error: "billing_unavailable" } });
    });
    await page.goto("/");
    await expect(page.getByText("0 free doodles left", { exact: true })).toBeVisible();
    await page.getByRole("textbox").fill(scene);
    await page.getByRole("button", { name: "Create doodle", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Keep doodling", exact: true });
    const packs = dialog.getByRole("radio");
    await expect(packs).toHaveCount(3);
    await packs.nth(purchase.index).click();
    const buy = dialog.getByRole("button", { name: `Get ${purchase.credits} doodles · ${purchase.price}`, exact: true });
    await expect(buy).toBeEnabled();
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await buy.click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    expect(checkoutBody).toEqual({ locale: "en", productId: purchase.productId, expectedCredits: purchase.credits });
    await dialog.getByRole("button", { name: "Not now", exact: true }).click();
    await expect(page.getByRole("textbox")).toHaveValue(scene);
    await expect(page.getByText("0 free doodles left", { exact: true })).toBeVisible();
  });
}
