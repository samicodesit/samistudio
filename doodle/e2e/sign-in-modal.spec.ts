import { expect, test, type Page } from "@playwright/test";

type Box = { top: number; height: number };
type ModalTraceRow = {
  dialog: Box | null;
  slip: Box | null;
  control: Box | null;
  scrollTop: number;
};
type OpenModalTraceRow = Omit<ModalTraceRow, "dialog" | "slip" | "control"> & {
  dialog: Box;
  slip: Box;
  control: Box;
};

function isOpenModalTraceRow(row: ModalTraceRow): row is OpenModalTraceRow {
  return row.dialog !== null && row.slip !== null && row.control !== null;
}

declare global {
  interface Window {
    __doodleModalTrace?: Promise<ModalTraceRow[]>;
  }
}

async function installStagedGoogleStub(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, "google", {
      configurable: true,
      value: {
        accounts: {
          id: {
            initialize() {},
            renderButton(element: HTMLElement) {
              const shell = document.createElement("div");
              shell.style.position = "relative";
              const lightButton = document.createElement("div");
              lightButton.style.height = "40px";
              const iframe = document.createElement("iframe");
              iframe.style.cssText = "display:block;position:relative;top:0;left:0;height:0;width:0;border:0";
              shell.append(lightButton, iframe);
              element.append(shell);
              window.setTimeout(() => {
                iframe.style.height = "44px";
                iframe.style.width = `${element.clientWidth + 20}px`;
                iframe.style.margin = "-2px -10px";
              }, 100);
              window.setTimeout(() => lightButton.remove(), 150);
            },
          },
        },
      },
    });
  });
  await page.route("https://accounts.google.com/gsi/client", (route) => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: "",
  }));
}

test("keeps the sign-in sheet geometry stable while Google initializes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installStagedGoogleStub(page);
  await page.route("**/api/account", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ authenticated: false, email: null, balance: 0, freeRemaining: 2 }),
  }));

  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Sign in" });
  await expect(trigger).toBeVisible();
  const startingScroll = await page.evaluate(() => document.scrollingElement?.scrollTop ?? 0);

  await page.evaluate(() => {
    window.__doodleModalTrace = new Promise<ModalTraceRow[]>((resolve) => {
      const rows: ModalTraceRow[] = [];
      const started = performance.now();
      const rect = (selector: string): Box | null => {
        const element = document.querySelector(selector);
        if (!(element instanceof Element)) return null;
        const box = element.getBoundingClientRect();
        return { top: box.top, height: box.height };
      };
      const sample = (now: number) => {
        rows.push({
          dialog: rect(".purchase-dialog"),
          slip: rect(".purchase-slip"),
          control: rect(".google-sign-in-control"),
          scrollTop: document.scrollingElement?.scrollTop ?? 0,
        });
        if (now - started < 700) requestAnimationFrame(sample);
        else resolve(rows);
      };
      requestAnimationFrame(sample);
    });
  });
  await trigger.click();

  const rows = await page.evaluate(() => window.__doodleModalTrace);
  const openRows = (rows ?? []).filter(isOpenModalTraceRow);
  expect(openRows.length).toBeGreaterThan(3);
  const range = (values: number[]) => Math.max(...values) - Math.min(...values);
  expect(range(openRows.map((row) => row.dialog.top))).toBeLessThan(1);
  expect(range(openRows.map((row) => row.dialog.height))).toBeLessThan(1);
  expect(range(openRows.map((row) => row.slip.top))).toBeLessThan(1);
  expect(range(openRows.map((row) => row.control.height))).toBeLessThan(1);
  expect(new Set(openRows.map((row) => row.scrollTop))).toEqual(new Set([startingScroll]));
});
