import { expect, test, type Page, type Route } from "@playwright/test";

type AccountState = {
  authenticated: boolean;
  deleted: boolean;
  authRequests: number;
  deleteRequests: number;
};

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  )).toBe(true);
}

async function installGoogleStub(page: Page) {
  await page.addInitScript(() => {
    let callback: ((response: { credential: string }) => void) | undefined;
    Object.defineProperty(window, "google", {
      configurable: true,
      value: {
        accounts: {
          id: {
            initialize(options: { callback(response: { credential: string }): void }) {
              callback = options.callback;
            },
            renderButton(element: HTMLElement, options: { width: number }) {
              const button = document.createElement("button");
              button.type = "button";
              button.setAttribute("role", "button");
              button.textContent = "Continue with Google";
              button.style.width = `${options.width}px`;
              button.addEventListener("click", () => callback?.({ credential: "mock-google-token" }));
              element.appendChild(button);
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

async function mockDeletionApis(page: Page, state: AccountState) {
  await page.route("**/api/auth/google", async (route) => {
    expect(route.request().postDataJSON()).toEqual({ credential: "mock-google-token" });
    state.authRequests += 1;
    state.authenticated = true;
    await route.fulfill({ status: 204 });
  });
  await page.route("**/api/account", async (route: Route) => {
    if (route.request().method() === "DELETE") {
      expect(route.request().postDataJSON()).toEqual({ confirm: true });
      state.deleteRequests += 1;
      state.deleted = true;
      state.authenticated = false;
      await route.fulfill({ status: 204 });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(state.authenticated && !state.deleted
        ? { authenticated: true, email: "buyer@example.com", balance: 3, freeRemaining: null }
        : { authenticated: false, email: null, balance: 0, freeRemaining: 1 }),
    });
  });
}

test("supports safe account deletion at mobile and desktop widths", async ({ page }, testInfo) => {
  const state: AccountState = {
    authenticated: false,
    deleted: false,
    authRequests: 0,
    deleteRequests: 0,
  };
  await installGoogleStub(page);
  await mockDeletionApis(page, state);

  for (const viewport of [{ width: 320, height: 740 }, { width: 1440, height: 1000 }]) {
    state.authenticated = viewport.width === 1440;
    state.deleted = false;
    state.deleteRequests = 0;
    await page.setViewportSize(viewport);
    await page.goto("/delete-account");
    await expect(page.getByRole("heading", { name: "Delete your Doodle account", level: 1 })).toBeVisible();

    if (!state.authenticated) {
      const signIn = page.locator(".google-sign-in");
      await expect(signIn).toBeVisible();
      const googleButton = page.getByRole("button", { name: "Continue with Google" });
      await expect(googleButton).toBeVisible();
      expect(await signIn.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      const signInScreenshotPath = testInfo.outputPath("delete-account-sign-in-320.png");
      await page.screenshot({ path: signInScreenshotPath, fullPage: true });
      await testInfo.attach("delete-account-sign-in-320.png", {
        path: signInScreenshotPath,
        contentType: "image/png",
      });
      await googleButton.click();
      await expect(page.getByText("buyer@example.com")).toBeVisible();
      expect(state.authRequests).toBe(1);
    }

    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: "Delete my Doodle account" }).click();
    await expect(page.getByRole("heading", { name: "Delete permanently?" })).toBeVisible();
    await expect(page.getByText("This removes your account and 3 unused doodle credits. This cannot be undone.")).toBeVisible();
    expect(state.deleteRequests).toBe(0);

    await page.getByRole("button", { name: "Keep account" }).click();
    await expect(page.getByRole("heading", { name: "Delete permanently?" })).toBeHidden();
    expect(state.deleteRequests).toBe(0);

    await page.getByRole("button", { name: "Delete my Doodle account" }).click();
    await expectNoHorizontalOverflow(page);
    const screenshotPath = testInfo.outputPath(`delete-account-confirm-${viewport.width}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await testInfo.attach(`delete-account-confirm-${viewport.width}.png`, {
      path: screenshotPath,
      contentType: "image/png",
    });

    await page.getByRole("button", { name: "Delete permanently" }).click();
    await expect(page.getByRole("heading", { name: "Account deleted" })).toBeVisible();
    expect(state.deleteRequests).toBe(1);
    await expectNoHorizontalOverflow(page);
  }
});
