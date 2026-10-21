import { expect, test } from "@playwright/test";
import { getCopy, localePath, SUPPORTED_LOCALES } from "../src/lib/i18n";

for (const viewport of [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  test.describe(`suggestion refresh at ${viewport.width}px`, () => {
    test.use({ viewport });

    for (const locale of SUPPORTED_LOCALES) {
      test(`${locale} keeps a draft while refreshing localized ideas`, async ({ page }) => {
        let generationCalls = 0;
        page.on("request", (request) => {
          if (new URL(request.url()).pathname === "/api/generate") generationCalls += 1;
        });
        await page.route("**/api/account", (route) => route.fulfill({ json: { authenticated: false, email: null, balance: 0, freeRemaining: 2 } }));
        await page.goto(`${localePath(locale)}?runtime=play`);
        const copy = getCopy(locale);
        const refresh = page.getByRole("button", { name: copy.suggestions.refresh, exact: true });
        const ideas = page.locator(".suggestions-list button");
        const draft = "A pencil beside a notebook";
        await page.getByRole("textbox").fill(draft);
        await expect(refresh).toBeVisible();
        await expect(refresh).toHaveAttribute("title", copy.suggestions.refresh);

        for (let turn = 0; turn < (locale === "en" && viewport.width === 390 ? 30 : 3); turn += 1) {
          const previous = await ideas.locator("span:first-child").allTextContents();
          await refresh.click();
          await expect(refresh).toBeEnabled();
          await expect(ideas).toHaveCount(3);
          const next = await ideas.locator("span:first-child").allTextContents();
          expect(new Set(next).size).toBe(3);
          expect(next.every((idea) => !previous.includes(idea))).toBe(true);
          expect(next.every((idea) => copy.suggestions.items.includes(idea))).toBe(true);
        }

        await expect(page.getByRole("textbox")).toHaveValue(draft);
        expect(generationCalls).toBe(0);
        await expect(refresh.locator("svg")).toHaveAttribute("width", "18");
        await expect(refresh).toHaveCSS("width", "48px");
        await expect(refresh).toHaveCSS("height", "48px");
        await expect(refresh).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
        await expect(page.locator(".suggestions-heading")).toHaveCSS("padding-bottom", "0px");
        const title = page.locator(".suggestions-heading h2");
        await expect(title).toHaveCSS("text-transform", "none");
        await expect(title).toHaveCSS("letter-spacing", "normal");
        await expect(title).toHaveCSS("font-weight", "600");
        const family = await title.evaluate(async (element) => {
          await document.fonts.ready;
          return getComputedStyle(element).fontFamily;
        });
        expect(family).not.toMatch(/monospace/);
        const fontSession = await page.context().newCDPSession(page);
        await fontSession.send("DOM.enable");
        await fontSession.send("CSS.enable");
        const { root } = await fontSession.send("DOM.getDocument");
        const { nodeId } = await fontSession.send("DOM.querySelector", { nodeId: root.nodeId, selector: "#suggestions-title" });
        const { fonts } = await fontSession.send("CSS.getPlatformFontsForNode", { nodeId });
        if (locale === "ja" || locale === "ko") {
          // Bricolage has no CJK glyphs, so these headings use the platform fallback.
          expect(fonts.some((font) => font.glyphCount > 0)).toBe(true);
        } else {
          expect(fonts).toEqual(expect.arrayContaining([expect.objectContaining({
            isCustomFont: true,
            familyName: expect.stringMatching(locale === "ar" ? /Alexandria/ : /Bricolage/),
          })]));
        }
        await fontSession.detach();
        const hint = await page.locator(".scene-hint").boundingBox();
        const composer = await page.locator(".doodle-composer").boundingBox();
        expect(hint!.height).toBeLessThan(64);
        expect(composer!.y - hint!.y - hint!.height).toBeGreaterThanOrEqual(0);
        expect(composer!.y - hint!.y - hint!.height).toBeLessThanOrEqual(12);
        const heading = await page.locator(".suggestions-heading h2").boundingBox();
        const button = await refresh.boundingBox();
        const icon = await refresh.locator("svg").boundingBox();
        const list = await page.locator(".suggestions-list").boundingBox();
        expect(heading).not.toBeNull();
        expect(button).not.toBeNull();
        expect(icon).not.toBeNull();
        expect(list).not.toBeNull();
        const edgeOffset = locale === "ar" ? icon!.x - list!.x : icon!.x + icon!.width - list!.x - list!.width;
        expect(Math.abs(edgeOffset)).toBeLessThanOrEqual(1);
        if (locale === "ar") expect(button!.x + button!.width).toBeLessThanOrEqual(heading!.x);
        else expect(heading!.x + heading!.width).toBeLessThanOrEqual(button!.x);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        const evidenceDir = process.env.DOODLE_SUGGESTION_QA_DIR;
        if (evidenceDir && ((locale === "en" && viewport.width !== 320) || (locale === "ar" && viewport.width === 320))) {
          await page.screenshot({ path: `${evidenceDir}/${locale}-${viewport.width}.png`, fullPage: true });
        }
      });
    }
  });
}

test("refresh animates only the icon and list, with a reduced-motion alternative", async ({ page }) => {
  await page.route("**/api/account", (route) => route.fulfill({ json: { authenticated: false, email: null, balance: 0, freeRemaining: 2 } }));
  await page.goto("/?runtime=play");
  const refresh = page.getByRole("button", { name: "Refresh ideas", exact: true });
  await expect(refresh).toBeVisible();
  await expect(page.locator(".suggestions-list")).toHaveAttribute("data-refresh-phase", "idle");
  const initial = await refresh.evaluate(async (button) => {
    (button as HTMLButtonElement).click();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    return {
      phase: document.querySelector(".suggestions-list")?.getAttribute("data-refresh-phase"),
      spin: getComputedStyle(button.querySelector("svg")!).animationName,
      disabled: (button as HTMLButtonElement).disabled,
    };
  });
  expect(initial).toEqual({ phase: "entering", spin: "suggestion-refresh-spin", disabled: true });
  await expect(refresh).toBeEnabled();
  await expect(page.locator(".suggestions-list")).toHaveAttribute("data-refresh-phase", "idle");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const before = await page.locator(".suggestions-list button span:first-child").allTextContents();
  const reduced = await refresh.evaluate(async (button) => {
    (button as HTMLButtonElement).click();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    return getComputedStyle(button.querySelector("svg")!).animationName;
  });
  await expect(refresh).toBeEnabled();
  await expect(page.locator(".suggestions-list")).toHaveAttribute("data-refresh-phase", "idle");
  expect(reduced).toBe("none");
  const after = await page.locator(".suggestions-list button span:first-child").allTextContents();
  expect(after.every((idea) => !before.includes(idea))).toBe(true);
});

test.describe("initial heading before hydration", () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });

  test("does not flash the old uppercase monospace heading", async ({ page }) => {
    await page.goto("/?runtime=play");
    const title = page.getByRole("heading", { name: "Or try one", exact: true });
    await expect(title).toHaveCSS("text-transform", "none");
    await expect(title).toHaveCSS("letter-spacing", "normal");
    await expect(title).toHaveCSS("font-size", "22px");
    await expect(title).toHaveCSS("font-weight", "600");
  });
});
