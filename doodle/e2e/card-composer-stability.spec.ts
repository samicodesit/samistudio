import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const imageFixture = fs.readFileSync(path.join(process.cwd(), "public/ideas/thank-you-mug.webp"));

type LocaleCase = {
  locale: "en" | "ar";
  url: string;
  sceneLabel: string;
  create: string;
  more: string;
  card: string;
  prefix: string;
  suffix: string;
  final: string;
};

const locales: LocaleCase[] = [
  {
    locale: "en",
    url: "/",
    sceneLabel: "Describe a scene",
    create: "Create doodle",
    more: "More options",
    card: "Make a card",
    prefix: "A little note",
    suffix: "for you",
    final: "A tiny message for your lunchbox note today with a little warmth",
  },
  {
    locale: "ar",
    url: "/ar",
    sceneLabel: "صِف ما تريد رسمه",
    create: "أنشئ رسمة",
    more: "المزيد من الخيارات",
    card: "أنشئ بطاقة",
    prefix: "رسالة صغيرة",
    suffix: "لك اليوم",
    final: "هذه رسالة قصيرة لصندوق الغداء اليوم مع قليل من الدفء",
  },
];

type Box = { x: number; y: number; width: number; height: number };
type Sample = {
  dialog: Box | null;
  controls: Box | null;
  heading: Box | null;
  textarea: Box | null;
  actions: Box | null;
  download: Box | null;
  share: Box | null;
  scrollY: number;
  textLength: number;
};

async function installFixture(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: async () => {} });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
  });
  await page.route("**/api/account", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ authenticated: false, email: null, balance: 0, freeRemaining: 2 }),
  }));
  await page.route("**/api/generate", route => route.fulfill({
    status: 200,
    contentType: "image/webp",
    body: imageFixture,
    headers: { "X-Doodle-Free-Remaining": "1" },
  }));
}

async function openComposer(page: Page, locale: LocaleCase) {
  await page.goto(locale.url);
  await page.getByLabel(locale.sceneLabel, { exact: true }).fill("A steaming mug beside a folded thank-you note with a tiny heart on it");
  await page.getByRole("button", { name: locale.create, exact: true }).click();
  await page.waitForSelector(".doodle-stage-result");
  await page.getByRole("button", { name: locale.more, exact: true }).click();
  await page.getByRole("button", { name: locale.card, exact: true }).click();
  await expect(page.locator(".card-composer-dialog")).toBeVisible();
  await expect(page.locator(".share-action")).toBeVisible();
  await expect(page.locator(".card-composer-actions")).not.toHaveClass(/is-single/);
  await expect(page.locator(".card-composer-actions .primary-action")).toBeEnabled();
}

async function sampleWhileTyping(page: Page, locale: LocaleCase, delay: number): Promise<Sample[]> {
  const duration = delay ? 6000 : 3000;
  const samplesPromise = page.evaluate(durationMs => new Promise<Sample[]>(resolve => {
    const started = performance.now();
    const rect = (selector: string): Box | null => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return null;
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    };
    const samples: Sample[] = [];
    const sample = () => {
      const input = document.querySelector("#card-message");
      samples.push({
        dialog: rect(".card-composer-dialog"),
        controls: rect(".card-composer-controls"),
        heading: rect(".card-composer-header h2"),
        textarea: rect("#card-message"),
        actions: rect(".card-composer-actions"),
        download: rect(".card-composer-actions .primary-action"),
        share: rect(".card-composer-actions .share-action"),
        scrollY: window.scrollY,
        textLength: input instanceof HTMLTextAreaElement ? input.value.length : 0,
      });
      if (performance.now() - started < durationMs) requestAnimationFrame(sample);
      else resolve(samples);
    };
    requestAnimationFrame(sample);
  }), duration);

  const input = page.locator("#card-message");
  await input.focus();
  await input.pressSequentially(locale.prefix, { delay });
  await input.press("Enter");
  await input.pressSequentially(locale.suffix, { delay });
  expect(await input.inputValue()).toContain("\n");
  await input.press("ControlOrMeta+A");
  await input.press("Backspace");
  await input.pressSequentially(locale.final, { delay });
  await input.press("ControlOrMeta+A");
  const expectedMessage = (locale.locale === "ar" ? "س" : "x").repeat(80);
  await input.pressSequentially(expectedMessage, { delay });
  await expect(input).toHaveValue(expectedMessage);
  await expect(page.locator(".card-composer-hint")).toContainText("80/80");
  return samplesPromise;
}

function expectStable(samples: Sample[], key: keyof Omit<Sample, "scrollY" | "textLength">) {
  const boxes = samples.map(sample => sample[key]).filter((box): box is Box => box !== null);
  expect(boxes.length).toBe(samples.length);
  const first = boxes[0];
  for (const box of boxes) {
    expect(Math.abs(box.x - first.x)).toBeLessThan(0.01);
    expect(Math.abs(box.y - first.y)).toBeLessThan(0.01);
    expect(Math.abs(box.width - first.width)).toBeLessThan(0.01);
    expect(Math.abs(box.height - first.height)).toBeLessThan(0.01);
  }
}

for (const locale of locales) {
  for (const [mode, delay] of [["rapid", 0], ["slow", 20]] as const) {
    for (const viewport of [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile360", width: 360, height: 844 }]) {
      test(`${locale.locale} ${mode} typing keeps the card form stable at ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await installFixture(page);
        await openComposer(page, locale);
        const samples = await sampleWhileTyping(page, locale, delay);
        expect(samples.length).toBeGreaterThan(10);
        expect(samples.every(sample => sample.share !== null)).toBe(true);
        for (const key of ["dialog", "controls", "heading", "textarea", "actions", "download", "share"] as const) expectStable(samples, key);
        expect(samples.every(sample => sample.scrollY === samples[0].scrollY)).toBe(true);
        expect(samples.every(sample => sample.textLength <= 80)).toBe(true);
      });
    }
  }
}
