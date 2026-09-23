import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  consumeNativeAttestation: vi.fn(),
  nativePrincipal: vi.fn(),
  getOrCreateNativeTrialIdentity: vi.fn(),
  getFreeRemaining: vi.fn(),
  signedTrialToken: vi.fn(),
}));
vi.mock("@/lib/native-attestation", () => ({
  consumeNativeAttestation: mocks.consumeNativeAttestation,
  nativePrincipal: mocks.nativePrincipal,
}));
vi.mock("@/lib/native-guest", () => ({
  getOrCreateNativeTrialIdentity: mocks.getOrCreateNativeTrialIdentity,
}));
vi.mock("@/lib/generation/free-allowance", () => ({
  getFreeRemaining: mocks.getFreeRemaining,
  signedTrialToken: mocks.signedTrialToken,
  TRIAL_TTL_SECONDS: 31_536_000,
}));

const installId = "11111111-1111-4111-8111-111111111111";
const identity = { id: "22222222-2222-4222-8222-222222222222" };

function request(body: unknown, origin = "https://doodle.samistudio.nl") {
  return new NextRequest("https://doodle.samistudio.nl/api/native/session/guest", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("native guest session route", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.consumeNativeAttestation.mockResolvedValue("verified");
    mocks.nativePrincipal.mockReturnValue("install:" + installId);
    mocks.getOrCreateNativeTrialIdentity.mockResolvedValue(identity);
    mocks.getFreeRemaining.mockResolvedValue(2);
    mocks.signedTrialToken.mockReturnValue("signed-trial-token");
  });

  it("consumes attestation before returning the existing signed trial token", async () => {
    const response = await POST(request({ installId, challenge: "a".repeat(43), integrityToken: "t".repeat(16) }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ trialToken: "signed-trial-token", freeRemaining: 2 });
    expect(mocks.consumeNativeAttestation).toHaveBeenCalledWith({
      operation: "guest",
      installId,
      sceneHash: null,
      principal: "install:" + installId,
      challenge: "a".repeat(43),
      integrityToken: "t".repeat(16),
    });
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rejects invalid input, cross-origin, and invalid Integrity before identity creation", async () => {
    expect((await POST(request({ installId, challenge: "a", integrityToken: "t" }, "https://evil.test"))).status).toBe(403);
    expect((await POST(request({ installId, challenge: "a", integrityToken: "t", extra: true }))).status).toBe(400);
    mocks.consumeNativeAttestation.mockResolvedValueOnce("invalid");
    const response = await POST(request({ installId, challenge: "a".repeat(43), integrityToken: "t".repeat(16) }));
    expect(response.status).toBe(403);
    expect(mocks.getOrCreateNativeTrialIdentity).not.toHaveBeenCalled();
  });

  it("fails closed while Integrity or Redis is unavailable", async () => {
    mocks.consumeNativeAttestation.mockResolvedValueOnce("unavailable");
    expect((await POST(request({ installId, challenge: "a".repeat(43), integrityToken: "t".repeat(16) }))).status).toBe(503);
    mocks.consumeNativeAttestation.mockResolvedValueOnce("verified");
    mocks.getOrCreateNativeTrialIdentity.mockRejectedValueOnce(new Error("redis"));
    expect((await POST(request({ installId, challenge: "a".repeat(43), integrityToken: "t".repeat(16) }))).status).toBe(503);
  });
});
