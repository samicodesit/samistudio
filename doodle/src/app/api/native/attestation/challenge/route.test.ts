import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  checkNativeChallengeLimit: vi.fn(),
  createNativeChallenge: vi.fn(),
  getCurrentUser: vi.fn(),
  getNativeBearer: vi.fn(),
  getTrialIdentity: vi.fn(),
  isValidTrialToken: vi.fn(),
  nativePrincipal: vi.fn(),
}));
vi.mock("@/lib/native-attestation", () => ({
  createNativeChallenge: mocks.createNativeChallenge,
  nativePrincipal: mocks.nativePrincipal,
  NativeAttestationUnavailableError: class NativeAttestationUnavailableError extends Error {},
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/native-session", () => ({ getNativeBearer: mocks.getNativeBearer }));
vi.mock("@/lib/generation/free-allowance", () => ({
  getTrialIdentity: mocks.getTrialIdentity,
  isValidTrialToken: mocks.isValidTrialToken,
}));
vi.mock("@/lib/generation/generation-limit", () => ({
  checkNativeChallengeLimit: mocks.checkNativeChallengeLimit,
}));

const installId = "11111111-1111-4111-8111-111111111111";
const user = { id: installId, identityKey: "a".repeat(64), email: "buyer@example.com" };

function request(
  body: unknown,
  origin = "https://doodle.samistudio.nl",
  extraHeaders: Record<string, string> = {},
) {
  return new NextRequest("https://doodle.samistudio.nl/api/native/attestation/challenge", {
    method: "POST",
    headers: { origin, "content-type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
  });
}

describe("native attestation challenge route", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.checkNativeChallengeLimit.mockResolvedValue("allowed");
    mocks.createNativeChallenge.mockResolvedValue({
      challenge: "b".repeat(43),
      requestHash: "c".repeat(43),
      expiresAt: Date.now() + 300_000,
    });
    mocks.nativePrincipal.mockImplementation((kind: string, id: string) => kind + ":" + id.toLowerCase());
    mocks.getTrialIdentity.mockReturnValue({ id: "22222222-2222-4222-8222-222222222222" });
    mocks.isValidTrialToken.mockReturnValue(true);
    mocks.getNativeBearer.mockReturnValue(undefined);
    mocks.getCurrentUser.mockResolvedValue(user);
  });

  it("creates a guest challenge with no account identity", async () => {
    const response = await POST(request({ operation: "guest", installId }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ challenge: "b".repeat(43) });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.createNativeChallenge).toHaveBeenCalledWith({
      operation: "guest",
      installId,
      sceneHash: null,
      principal: "install:" + installId,
    });
  });

  it("requires a bearer for a generate challenge", async () => {
    mocks.getNativeBearer.mockReturnValue(null);
    const response = await POST(request({
      operation: "generate",
      installId,
      sceneHash: "a".repeat(64),
    }));
    expect(response.status).toBe(401);
    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
  });

  it("accepts a valid signed trial context for a generate challenge", async () => {
    const response = await POST(request({
      operation: "generate",
      installId,
      sceneHash: "a".repeat(64),
    }, "https://doodle.samistudio.nl", {
      "x-doodle-trial-token": "signed-trial-token",
    }));

    expect(response.status).toBe(200);
    expect(mocks.isValidTrialToken).toHaveBeenCalledWith("signed-trial-token");
    expect(mocks.getTrialIdentity).toHaveBeenCalled();
    expect(mocks.createNativeChallenge).toHaveBeenCalledWith({
      operation: "generate",
      installId,
      sceneHash: "a".repeat(64),
      principal: "trial:22222222-2222-4222-8222-222222222222",
    });
  });

  it("rejects ambiguous bearer and trial credentials", async () => {
    mocks.getNativeBearer.mockReturnValue("d".repeat(43));
    const response = await POST(request({
      operation: "generate",
      installId,
      sceneHash: "a".repeat(64),
    }, "https://doodle.samistudio.nl", {
      authorization: `Bearer ${"d".repeat(43)}`,
      "x-doodle-trial-token": "signed-trial-token",
    }));

    expect(response.status).toBe(400);
    expect(mocks.createNativeChallenge).not.toHaveBeenCalled();
  });

  it("fails closed when trial-token verification cannot load its signing secret", async () => {
    mocks.isValidTrialToken.mockImplementation(() => {
      throw new Error("SESSION_SECRET is required");
    });
    const response = await POST(request({
      operation: "generate",
      installId,
      sceneHash: "a".repeat(64),
    }, "https://doodle.samistudio.nl", {
      "x-doodle-trial-token": "signed-trial-token",
    }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "native_generation_unavailable" });
    expect(mocks.createNativeChallenge).not.toHaveBeenCalled();
  });

  it("rate-limits guest challenge issuance before Redis challenge allocation", async () => {
    mocks.checkNativeChallengeLimit.mockResolvedValue("rate_limited");

    const response = await POST(request({ operation: "guest", installId }));

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "rate_limited" });
    expect(mocks.checkNativeChallengeLimit).toHaveBeenCalledWith(expect.any(NextRequest), "guest");
    expect(mocks.createNativeChallenge).not.toHaveBeenCalled();
  });

  it("fails closed when challenge rate-limit storage is unavailable", async () => {
    mocks.checkNativeChallengeLimit.mockResolvedValue("unavailable");

    const response = await POST(request({ operation: "guest", installId }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "native_generation_unavailable" });
    expect(mocks.createNativeChallenge).not.toHaveBeenCalled();
  });

  it("checks the bearer account before a generate challenge", async () => {
    mocks.getNativeBearer.mockReturnValue("d".repeat(43));
    const response = await POST(request({
      operation: "generate",
      installId,
      sceneHash: "a".repeat(64),
    }));
    expect(response.status).toBe(200);
    expect(mocks.getCurrentUser).toHaveBeenCalled();
    expect(mocks.createNativeChallenge).toHaveBeenCalledWith({
      operation: "generate",
      installId,
      sceneHash: "a".repeat(64),
      principal: "account:" + installId,
    });
  });

  it("rejects cross-origin and extra-key requests", async () => {
    expect((await POST(request({ operation: "guest", installId }, "https://evil.test"))).status).toBe(403);
    expect((await POST(request({ operation: "guest", installId, extra: true }))).status).toBe(400);
    expect(mocks.createNativeChallenge).not.toHaveBeenCalled();
  });

  it("rejects an oversized body before challenge creation", async () => {
    const response = await POST(new NextRequest("https://doodle.samistudio.nl/api/native/attestation/challenge", {
      method: "POST",
      headers: { origin: "https://doodle.samistudio.nl", "content-type": "application/json" },
      body: JSON.stringify({ operation: "guest", installId, extra: "x".repeat(5_000) }),
    }));
    expect(response.status).toBe(413);
    expect(mocks.createNativeChallenge).not.toHaveBeenCalled();
  });
});
