import { defineConfig, devices } from "@playwright/test";

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
    command: "npm run dev -- --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      SESSION_SECRET: "test-session-secret-with-at-least-32-characters",
      OPENAI_API_KEY: "test-key-not-used-because-generation-is-mocked",
      OPENAI_IMAGE_MODEL: "gpt-image-1-mini",
      OPENAI_IMAGE_QUALITY: "low",
      NEXT_PUBLIC_SUPABASE_URL: "https://doodle-e2e.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "e2e-publishable-key",
      SUPABASE_SERVICE_ROLE_KEY: "e2e-service-role-key",
    },
  },
});
