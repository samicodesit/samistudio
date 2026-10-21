import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function readConfig() {
  vi.resetModules();
  return (await import("../../app.config")).default;
}

describe("iOS build identity", () => {
  it("uses production App Attest for distribution and accepts an explicit development test build", async () => {
    vi.stubEnv("DOODLE_APP_ATTEST_ENVIRONMENT", "");
    expect((await readConfig()).ios?.entitlements?.["com.apple.developer.devicecheck.appattest-environment"]).toBe("production");
    vi.stubEnv("DOODLE_APP_ATTEST_ENVIRONMENT", "development");
    expect((await readConfig()).ios?.entitlements?.["com.apple.developer.devicecheck.appattest-environment"]).toBe("development");
    vi.stubEnv("DOODLE_APP_ATTEST_ENVIRONMENT", "prodution");
    await expect(readConfig()).rejects.toThrow("DOODLE_APP_ATTEST_ENVIRONMENT");
  });
  it("enables the native Apple sign-in capability and localized system button", async () => {
    const config = await readConfig();
    expect(config.ios?.usesAppleSignIn).toBe(true);
    expect(config.plugins).toContain("expo-apple-authentication");
  });

  it("keeps the distribution identity live even if a stale fixture flag is present", async () => {
    vi.stubEnv("DOODLE_IOS_BUILD_VARIANT", "production");
    vi.stubEnv("EXPO_PUBLIC_NATIVE_FIXTURE_MODE", "true");
    const config = await readConfig();
    expect(config.ios?.bundleIdentifier).toBe("nl.samistudio.doodle");
    const { isNativeFixtureMode } = await import("./fixture-gate");
    expect(isNativeFixtureMode(config.ios?.bundleIdentifier ?? null, config.extra?.nativeFixtureMode)).toBe(false);
  });

  it("isolates a simulator fixture from the distribution app and Android identity", async () => {
    vi.stubEnv("DOODLE_IOS_BUILD_VARIANT", "production");
    const production = await readConfig();
    vi.stubEnv("DOODLE_IOS_BUILD_VARIANT", "fixture");
    vi.stubEnv("EXPO_PUBLIC_NATIVE_FIXTURE_MODE", "");
    const config = await readConfig();
    const { isNativeFixtureMode } = await import("./fixture-gate");
    expect(isNativeFixtureMode(config.ios?.bundleIdentifier ?? null, config.extra?.nativeFixtureMode)).toBe(true);
    expect(config.android?.package).toBe("nl.samistudio.doodle");
    expect(config.android?.versionCode).toBe(production.android?.versionCode);
  });

  it("rejects a mistyped build variant rather than silently producing another app", async () => {
    vi.stubEnv("DOODLE_IOS_BUILD_VARIANT", "fixtuer");
    await expect(readConfig()).rejects.toThrow("DOODLE_IOS_BUILD_VARIANT");
  });
});
