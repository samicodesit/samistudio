import { defineConfig, devices } from "@playwright/test";

const useProductionServer = process.env.PLAYWRIGHT_PRODUCTION === "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: useProductionServer ? "npm run start -- --port 3100" : "npm run dev -- --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: !process.env.CI && !useProductionServer,
    timeout: 120_000,
    env: {
      SESSION_SECRET: "test-session-secret-with-at-least-32-characters",
      OPENAI_API_KEY: "test-key-not-used-because-generation-is-mocked",
      OPENAI_IMAGE_MODEL: "gpt-image-1-mini",
      OPENAI_IMAGE_QUALITY: "low",
      NEXT_PUBLIC_GOOGLE_CLIENT_ID: "playwright-google-client-id",
    },
  },
});
