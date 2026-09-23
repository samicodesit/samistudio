import { describe, expect, it, vi } from "vitest";

vi.mock("expo-asset", () => ({
  Asset: { fromModule: () => ({ downloadAsync: async () => undefined, localUri: "file:///fixture.png", uri: "file:///fixture.png" }) },
}));
vi.mock("../platform/assets", () => ({ NATIVE_REFERENCE_IMAGE: 1 }));

import { createFrontendFixtureServices } from "./fixture-runtime";

describe("presentation fixture service boundary", () => {
  const services = createFrontendFixtureServices(true);

  it("does not start the live Google auth flow", async () => {
    await expect(services.auth.signIn()).resolves.toMatchObject({
      authenticated: true,
      email: "preview@example.test",
    });
  });

  it("keeps report submission local to the fixture", async () => {
    await expect(services.reports.submit({
      locale: "en",
      report: { reason: "unclear", details: "", includeContent: false },
    })).resolves.toEqual({ id: "fixture-report" });
  });

  it("keeps the trial allowance available after sign-in when paid balance is zero", async () => {
    const fixture = createFrontendFixtureServices(true, { generationDelayMs: 0 });
    await fixture.auth.signIn();

    await expect(fixture.api.getAccount()).resolves.toMatchObject({
      authenticated: true,
      balance: 0,
      freeRemaining: 2,
    });
    await expect(fixture.api.generate("A small test scene")).resolves.toMatchObject({
      freeRemaining: 1,
    });
    await expect(fixture.api.getAccount()).resolves.toMatchObject({
      authenticated: true,
      balance: 0,
      freeRemaining: 1,
    });

    await fixture.billing.buy();
    await expect(fixture.api.generate("A second test scene")).resolves.toMatchObject({
      paidRemaining: 9,
    });
  });
});
