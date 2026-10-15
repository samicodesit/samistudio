import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

// Separate matrix keeps the ordinary suite quick. An external server supports
// running current Windows WebKit against the app hosted in WSL.
export default defineConfig({
  ...base,
  testMatch: "photo-preparation.spec.ts",
  workers: 1,
  outputDir: "test-results/photo-webkit",
  // Keep API interception reliable after the app registers its offline worker.
  // Offline/PWA behavior has its own suite.
  use: { ...base.use, serviceWorkers: "block" },
  webServer: process.env.PLAYWRIGHT_EXTERNAL_SERVER === "1" ? undefined : base.webServer,
  projects: [
    { name: "webkit-iphone-se", use: { ...devices["iPhone SE (3rd gen)"] } },
    { name: "webkit-iphone-13", use: { ...devices["iPhone 13"] } },
    { name: "webkit-iphone-large", use: { ...devices["iPhone 13 Pro Max"] } },
    { name: "chromium-mobile", use: { ...devices["Pixel 5"] } },
  ],
});
