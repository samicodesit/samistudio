vi.mock("server-only", () => ({}));
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({ getNativeAttestationConfig: vi.fn(), getAppleAttestationConfig: vi.fn() }));

vi.mock("@/lib/native-attestation", () => ({
  getNativeAttestationConfig: mocks.getNativeAttestationConfig,
}));

vi.mock("@/lib/apple-attestation", () => ({ getAppleAttestationConfig: mocks.getAppleAttestationConfig }));

describe("native config route", () => {
  beforeEach(() => {
    mocks.getNativeAttestationConfig.mockReset();
  });

  it("reports a disabled, non-credential-bearing config when Integrity is unavailable", async () => {
    mocks.getNativeAttestationConfig.mockReturnValue(null);

    const response = await GET(new Request("https://doodle.samistudio.nl/api/native/config"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      enabled: false,
      packageName: "nl.samistudio.doodle",
      minimumVersionCode: 2,
      attestation: "play_integrity",
      guestEnabled: false,
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("exposes only the public project number for a valid config", async () => {
    mocks.getNativeAttestationConfig.mockReturnValue({ cloudProjectNumber: "368967912119" });

    const response = await GET(new Request("https://doodle.samistudio.nl/api/native/config"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      enabled: true,
      packageName: "nl.samistudio.doodle",
      minimumVersionCode: 2,
      attestation: "play_integrity",
      guestEnabled: true,
      cloudProjectNumber: "368967912119",
    });
  });

  it("fails closed when enabled configuration is malformed", async () => {
    mocks.getNativeAttestationConfig.mockImplementation(() => {
      throw new Error("private key");
    });

    const response = await GET(new Request("https://doodle.samistudio.nl/api/native/config"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "native_generation_unavailable" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

it("exposes App Attest config only to iPhone clients", async () => {
  mocks.getAppleAttestationConfig.mockReturnValue({ environment: "production" });
  const result = await GET(new Request("https://doodle.samistudio.nl/api/native/config", { headers: { "x-doodle-client": "native-ios" } }));
  expect(await result.json()).toMatchObject({ enabled: true, attestation: "app_attest", minimumBuild: "1", environment: "production" });
  expect(mocks.getNativeAttestationConfig).not.toHaveBeenCalled();
});

});
