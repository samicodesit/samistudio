import { defineConfig, devices } from "@playwright/test";

const useProductionServer = process.env.PLAYWRIGHT_PRODUCTION === "1";
const port = process.env.PLAYWRIGHT_PORT || "3100";
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: useProductionServer ? `npm run start -- --port ${port}` : `npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI && !useProductionServer,
    timeout: 120_000,
    env: {
      SESSION_SECRET: "test-session-secret-with-at-least-32-characters",
      OPENAI_API_KEY: "test-key-not-used-because-generation-is-mocked",
      OPENAI_IMAGE_MODEL: "gpt-image-2.5-flare",
      OPENAI_IMAGE_QUALITY: "medium",
      NEXT_PUBLIC_GOOGLE_CLIENT_ID: "playwright-google-client-id",
    },
  },
});
