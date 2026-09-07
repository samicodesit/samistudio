import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test("installed workspace has focused tabs and preserves a draft while browsing", async ({ page }) => {
  await page.route("**/api/account", route => route.fulfill({ json: { authenticated: false, email: null, balance: 0, freeRemaining: 2 } }));
  await page.goto("/?runtime=play");
  const nav = page.getByRole("navigation", { name: "Doodle app" });
  await expect(nav).toBeVisible();
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
