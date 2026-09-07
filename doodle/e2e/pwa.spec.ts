import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const referencePng = fs.readFileSync(path.join(process.cwd(), "public/references/doodle-reference-kiss.png"));

async function waitForWorkerControl(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller) return;
    await new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true });
    });
  });
}

async function offlineCacheEntries(page: Page) {
  return page.evaluate(async () => {
    const cacheNames = (await caches.keys()).filter((name) => name.startsWith("doodle-offline-"));
    const entries = await Promise.all(cacheNames.map(async (name) => ({
      name,
      urls: (await (await caches.open(name)).keys()).map((request) => new URL(request.url).pathname),
    })));
    return entries;
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

test.describe("PWA foundation", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/account", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ authenticated: false, email: null, balance: 0, freeRemaining: 2 }),
    }));
  });

  test("publishes install metadata and keeps online private flows out of Cache Storage", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");

    const manifestResponse = await page.request.get("/manifest.webmanifest");
    expect(manifestResponse.ok()).toBe(true);
    const manifest = await manifestResponse.json();
    expect(manifest).toMatchObject({
      name: "Doodle",
      short_name: "Doodle",
      start_url: "/",
      display: "standalone",
      background_color: "#eef1ea",
      theme_color: "#195c47",
    });
    expect(manifest.icons).toEqual([
      { src: "/pwa/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/icon/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ]);
    for (const icon of manifest.icons as Array<{ src: string; sizes: string }>) {
      const response = await page.request.get(icon.src);
      expect(response.ok()).toBe(true);
      expect(response.headers()["content-type"]).toContain("image/png");
      const dimensions = await page.evaluate(async (src) => {
        const image = new Image();
        image.src = src;
        await image.decode();
        return { width: image.naturalWidth, height: image.naturalHeight };
      }, icon.src);
      const expectedSize = Number(icon.sizes.split("x")[0]);
      expect(dimensions).toEqual({ width: expectedSize, height: expectedSize });
    }

    await waitForWorkerControl(page);
    expect(await offlineCacheEntries(page)).toEqual([
      { name: "doodle-offline-v1", urls: ["/offline.html"] },
    ]);

    await page.route("**/api/generate", (route) => route.fulfill({
      status: 200,
      contentType: "image/png",
      body: referencePng,
    }));
    await page.getByRole("textbox").fill("A private scene that must never be cached");
    await page.getByRole("button", { name: "Create doodle", exact: true }).click();
    await expect(page.getByAltText("Generated sticky-note doodle")).toBeVisible();
    expect(await offlineCacheEntries(page)).toEqual([
      { name: "doodle-offline-v1", urls: ["/offline.html"] },
    ]);
  });

  test("falls back only for localized document navigation and retries the original URL", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/de");
    await waitForWorkerControl(page);
    await page.context().setOffline(true);
    await page.goto("/de?scene=private-value");

    await expect(page.getByRole("heading", { name: "Du bist offline" })).toBeVisible();
    await expect(page.getByText("Zum Erstellen eines Doodles brauchst du eine Internetverbindung.")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("private-value");
    await expectNoHorizontalOverflow(page);
    expect(await offlineCacheEntries(page)).toEqual([
      { name: "doodle-offline-v1", urls: ["/offline.html"] },
    ]);
    await page.screenshot({ path: testInfo.outputPath("pwa-offline-de-390x844.png") });

    await page.context().setOffline(false);
    await page.getByRole("button", { name: "Erneut versuchen" }).click();
    await expect(page.getByRole("heading", { name: "Was sollen wir zeichnen?" })).toBeVisible();
    await expect(page).toHaveURL(/\/de\?scene=private-value$/);

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.context().setOffline(true);
    await page.goto("/ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "أنت غير متصل" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("pwa-offline-ar-desktop-1440x1000.png") });
  });
});
