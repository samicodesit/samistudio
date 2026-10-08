import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const fixtures = path.join(process.cwd(), "e2e/fixtures/photo");
const create = (page: Page) => page.getByRole("button", { name: "Create doodle", exact: true });
async function choose(page: Page, file: string) {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /^(Use a photo|Change photo)$/ }).click();
  await (await chooser).setFiles(path.join(fixtures, file));
  await expect(page.locator(".doodle-composer")).toHaveAttribute("aria-busy", "false");
  await expect(page.getByRole("img", { name: "Selected photo" })).toBeVisible();
  await expect(create(page)).toBeEnabled();
}
async function pixels(page: Page) {
  return page.getByRole("img", { name: "Selected photo" }).evaluate(async (image: HTMLImageElement) => {
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d")!; ctx.drawImage(image, 0, 0);
    const points = [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75], [0.01, 0.01], [0.5, 0.5]];
    return { width: canvas.width, height: canvas.height,
      colors: points.map(([x, y]) => [...ctx.getImageData(Math.floor(x * canvas.width), Math.floor(y * canvas.height), 1, 1).data].slice(0, 3)) };
  });
}
async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const buttons = await page.locator(".composer-footer button").all();
  const boxes = await Promise.all(buttons.map(button => button.boundingBox()));
  expect(boxes.every(box => box && box.width >= 44 && box.height >= 44)).toBe(true);
  expect(boxes[0]!.x + boxes[0]!.width).toBeLessThanOrEqual(boxes[1]!.x + 1);
}
test.beforeEach(async ({ page }) => {
  await page.route("**/api/account", route => route.fulfill({ json: { authenticated: false, email: null, balance: 0, freeRemaining: 2 } }));
  // Fail closed: this suite must never reach a paid generation endpoint.
  await page.route("**/api/generate", route => route.abort("blockedbyclient"));
  await page.goto("/");
  // Server-rendered controls exist before React has attached their handlers.
  await expect(page.locator(".usage-copy")).toContainText("2 free doodles left");
  await expect(page.getByRole("radio", { name: "Simple", exact: true })).toBeEnabled();
  await page.evaluate(() => document.fonts.ready);
});

test("all camera rotations and mirrors preserve proportions and actual pixels", async ({ page }) => {
  const colors = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0]];
  const order = [[0, 1, 2, 3], [1, 0, 3, 2], [3, 2, 1, 0], [2, 3, 0, 1], [0, 2, 1, 3], [2, 0, 3, 1], [3, 1, 2, 0], [1, 3, 0, 2]];
  for (let orientation = 1; orientation <= 8; orientation++) {
    await choose(page, `orientation-${orientation}.jpg`);
    const actual = await pixels(page);
    expect([actual.width, actual.height]).toEqual(orientation >= 5 ? [400, 600] : [600, 400]);
    order[orientation - 1].forEach((color, i) => colors[color].forEach((channel, j) => expect(Math.abs(actual.colors[i][j] - channel)).toBeLessThanOrEqual(20)));
  }
  await fits(page);
});

test("48 MP, transparency, panoramas and small WebP prepare without changing the detail setting", async ({ page }, testInfo) => {
  await page.getByRole("radio", { name: "Detailed", exact: true }).click();
  await choose(page, "camera-48mp.jpg");
  expect(await pixels(page)).toMatchObject({ width: 600, height: 450 });
  await choose(page, "transparent.png");
  const transparent = await pixels(page);
  expect(transparent).toMatchObject({ width: 600, height: 400 });
  expect(transparent.colors[4]).toEqual([255, 255, 255]);
  expect(transparent.colors[5]).toEqual([254, 0, 0]);
  await expect(page.getByRole("radio", { name: "Detailed", exact: true })).toHaveAttribute("aria-checked", "true");
  await fits(page);
  await page.locator(".composer-section").screenshot({ path: testInfo.outputPath("photo-composer.png") });
  await choose(page, "tall.png");
  expect(await pixels(page)).toMatchObject({ width: 5, height: 600 });
  await choose(page, "small.webp");
  expect(await pixels(page)).toMatchObject({ width: 120, height: 80 });
});

test("cancel and corrupt replacement preserve the photo, Remove restores writing and focus", async ({ page }) => {
  const generationRequests: string[] = [];
  page.on("request", request => { if (request.url().includes("/api/generate")) generationRequests.push(request.url()); });
  await page.getByRole("textbox").fill("A small coffee cup");
  await choose(page, "transparent.png");
  const previous = await page.getByRole("img", { name: "Selected photo" }).getAttribute("src");
  let chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Change photo", exact: true }).click();
  await (await chooser).setFiles([]);
  await expect(page.getByRole("img", { name: "Selected photo" })).toHaveAttribute("src", previous!);
  chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Change photo", exact: true }).click();
  await (await chooser).setFiles({ name: "damaged.jpg", mimeType: "image/jpeg", buffer: Buffer.from("not a photo") });
  await expect(page.locator(".composer-section").getByRole("alert")).toContainText("could not be opened");
  await expect(page.getByRole("img", { name: "Selected photo" })).toHaveAttribute("src", previous!);
  await expect(create(page)).toBeEnabled();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByRole("textbox")).toHaveValue("A small coffee cup");
  await expect(page.getByRole("textbox")).toBeFocused();
  await expect(page.locator(".composer-section").getByRole("alert")).toHaveCount(0);
  expect(generationRequests).toEqual([]);
});

test("prepared draft returns after reload and size rejection leaves it usable", async ({ page }) => {
  await choose(page, "orientation-6.jpg");
  const previous = await page.getByRole("img", { name: "Selected photo" }).getAttribute("src");
  // Wait for the app's actual IndexedDB write to finish before a return visit.
  await expect.poll(() => page.evaluate(async () => {
    const id = sessionStorage.getItem("doodle:photo-draft-id");
    if (!id) return false;
    return new Promise<boolean>((resolve, reject) => {
      const request = indexedDB.open("doodle-photo-draft", 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("drafts", "readonly");
        const entry = tx.objectStore("drafts").get(id);
        let saved = false;
        entry.onsuccess = () => { saved = typeof entry.result?.base64 === "string"; };
        tx.oncomplete = () => { db.close(); resolve(saved); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
    });
  })).toBe(true);
  await page.reload();
  await expect(page.getByRole("img", { name: "Selected photo" })).toHaveAttribute("src", previous!);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Change photo", exact: true }).click();
  await (await chooser).setFiles({ name: "oversized.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(20_000_001) });
  await expect(page.locator(".composer-section").getByRole("alert")).toContainText("too large");
  await expect(page.getByRole("img", { name: "Selected photo" })).toHaveAttribute("src", previous!);
  await expect(create(page)).toBeEnabled();
});

test("Create sends only the prepared photo and chosen detail; a recoverable error preserves both", async ({ page }) => {
  const requests: Record<string, unknown>[] = [];
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("requestfailed", request => { if (request.url().includes("/api/generate")) errors.push(request.failure()?.errorText ?? "network failure"); });
  await page.route("**/api/generate", route => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ status: 502, json: { error: "temporary_error" } });
  });
  await page.getByRole("textbox").fill("Saved writing draft");
  await page.getByRole("radio", { name: "Medium", exact: true }).click();
  await choose(page, "orientation-6.jpg");
  const previous = await page.getByRole("img", { name: "Selected photo" }).getAttribute("src");
  await create(page).click();
  await expect.poll(() => ({ requests: requests.length, errors })).toEqual({ requests: 1, errors: [] });
  expect(Object.keys(requests[0]).sort()).toEqual(["detailLevel", "photo"]);
  expect(requests[0].detailLevel).toBe("medium");
  expect(Buffer.from(requests[0].photo as string, "base64").length).toBeLessThanOrEqual(512_000);
  expect(`data:image/jpeg;base64,${requests[0].photo}`).toBe(previous);
  await expect(page.getByRole("img", { name: "Selected photo" })).toHaveAttribute("src", previous!);
  await expect(page.getByRole("radio", { name: "Medium", exact: true })).toHaveAttribute("aria-checked", "true");
  await expect(create(page)).toBeEnabled();
});

test("local preparation benchmark on previously approved public research photos", async ({ page }, testInfo) => {
  const directory = process.env.PHOTO_BENCHMARK_INPUT_DIR;
  test.skip(!directory, "Set PHOTO_BENCHMARK_INPUT_DIR to the existing public research inputs.");
  await page.evaluate(() => {
    document.addEventListener("change", event => {
      const input = event.target as HTMLInputElement;
      if (input.type !== "file" || !input.files?.[0]) return;
      const file = input.files[0];
      performance.mark("photo-preparation-start");
      const previous = document.querySelector<HTMLImageElement>(".photo-preview")?.src;
      const observer = new MutationObserver(() => {
        const image = document.querySelector<HTMLImageElement>(".photo-preview");
        if (!image || image.src === previous || document.querySelector(".doodle-composer")?.getAttribute("aria-busy") !== "false") return;
        performance.measure(`photo-preparation:${file.name}`, "photo-preparation-start");
        observer.disconnect();
      });
      observer.observe(document.body, { childList: true, attributes: true, subtree: true });
    }, true);
  });
  const samples: object[] = [];
  const inputs = ["portrait", "coffee", "cat", "woman-dog", "two-dogs"].map(subject => ({ subject, file: path.join(directory!, `${subject}-download.png`) }));
  inputs.push({ subject: "synthetic-camera-48mp", file: path.join(fixtures, "camera-48mp.jpg") });
  mkdirSync(testInfo.outputDir, { recursive: true });
  for (let repeat = 0; repeat < 3; repeat++) {
    for (const { subject, file } of inputs) {
      const chooser = page.waitForEvent("filechooser");
      await page.getByRole("button", { name: /^(Use a photo|Change photo)$/ }).click();
      await (await chooser).setFiles(file);
      await expect.poll(() => page.evaluate(() => performance.getEntriesByType("measure").filter(entry => entry.name.startsWith("photo-preparation:")).length)).toBe(samples.length + 1);
      const output = await page.getByRole("img", { name: "Selected photo" }).evaluate(async (image: HTMLImageElement) => {
        await image.decode();
        const encoded = image.src.slice(23);
        const measure = performance.getEntriesByType("measure").filter(entry => entry.name.startsWith("photo-preparation:")).at(-1) as PerformanceMeasure;
        return { width: image.naturalWidth, height: image.naturalHeight, encoded, preparationMs: measure.duration };
      });
      const bytes = Buffer.from(output.encoded, "base64");
      expect(Math.max(output.width, output.height)).toBeLessThanOrEqual(600);
      expect(bytes.length).toBeLessThanOrEqual(512_000);
      if (repeat === 0) writeFileSync(testInfo.outputPath(`${subject}-prepared.jpg`), bytes);
      samples.push({ subject, repeat, sourceBytes: statSync(file).size, width: output.width, height: output.height, preparationMs: output.preparationMs, jpegBytes: bytes.length,
        jsonRequestBytes: Buffer.byteLength(JSON.stringify({ photo: output.encoded, detailLevel: "medium" })) });
    }
  }
  await fits(page);
  // Preserve real pixels and metrics only, never log photo base64 or originals.
  writeFileSync(testInfo.outputPath("preparation-benchmark.json"), JSON.stringify({ browser: testInfo.project.name, samples }, null, 2));
  await page.locator(".composer-section").screenshot({ path: testInfo.outputPath("benchmark-composer.png") });
});
