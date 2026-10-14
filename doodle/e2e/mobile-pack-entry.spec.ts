import { expect, test } from "@playwright/test";

const packsEnabled = process.env.PLAYWRIGHT_WEB_PACKS_ENABLED !== "false";
for (const width of [360, 1280]) {
  for (const panel of ["Settings", "Ideas"]) {
    test(`${width}px Get more remains visible from ${panel}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 640 });
      await page.route("**/api/account", route => route.fulfill({ json: { authenticated: true, email: "qa@example.test", balance: 0, freeRemaining: 0, hasPurchased: true } }));
      await page.route("**/api/checkout/catalog", route => route.fulfill({ json: {
        offerEnd: "2026-10-31T23:59:59+01:00",
        packs: [
          { productId: "pack_mini", credits: 6, normalCredits: 6, offerApplied: false, unitAmount: 199, currency: "EUR" },
          { productId: "pack_regular", credits: 25, normalCredits: 20, offerApplied: true, unitAmount: 499, currency: "EUR" },
          { productId: "pack_big", credits: 60, normalCredits: 60, offerApplied: false, unitAmount: 999, currency: "EUR" },
        ],
      } }));
      await page.route("**/api/checkout/elements", route => route.fulfill({ status: 503, json: { error: "billing_unavailable" } }));
      await page.goto("/?runtime=app");
      await page.getByRole("textbox").fill("A cat holding a flower");
      await page.getByRole("button", { name: panel, exact: true }).click();
      await page.locator('summary[title="Account"]').click();
      await page.getByRole("button", { name: "Get more", exact: true }).click();
      const buy = page.getByRole("button", { name: packsEnabled ? /Get 25 doodles/ : "Get 10 doodles", exact: !packsEnabled });
      await expect(buy).toBeVisible();
      await expect(buy).toBeEnabled();
      const bounds = await buy.boundingBox();
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(640);
      await page.getByRole("button", { name: "Not now", exact: true }).click();
      await page.getByRole("button", { name: "Create", exact: true }).click();
      await expect(page.getByRole("textbox")).toHaveValue("A cat holding a flower");
    });
  }
}
