import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  createOrGetGoogleAccount: vi.fn(),
  verifyGoogleCredential: vi.fn(),
  createNativeSession: vi.fn(),
}));
vi.mock("@/lib/auth/accounts", () => ({ createOrGetGoogleAccount: mocks.createOrGetGoogleAccount }));
vi.mock("@/lib/auth/google", () => ({ verifyGoogleCredential: mocks.verifyGoogleCredential }));
vi.mock("@/lib/native-session", () => ({ createNativeSession: mocks.createNativeSession }));

const account = { id: "11111111-1111-4111-8111-111111111111", identityKey: "a".repeat(64) };

function request(body: unknown, origin = "https://doodle.samistudio.nl") {
  return new NextRequest("https://doodle.samistudio.nl/api/native/auth/google", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("native Google auth route", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.verifyGoogleCredential.mockResolvedValue({ sub: "google-sub", email: "buyer@example.com" });
    mocks.createOrGetGoogleAccount.mockResolvedValue(account);
    mocks.createNativeSession.mockResolvedValue({ accessToken: "a".repeat(43), expiresAt: 123 });
  });

  it("returns the opaque session for the same Google account mapping", async () => {
    const response = await POST(request({ credential: "google-id-token" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      authenticated: true,
      email: "buyer@example.com",
      accessToken: "a".repeat(43),
      expiresAt: 123,
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(mocks.verifyGoogleCredential).toHaveBeenCalledWith("google-id-token");
    expect(mocks.createOrGetGoogleAccount).toHaveBeenCalledWith("google-sub");
    expect(mocks.createNativeSession).toHaveBeenCalledWith({ ...account, email: "buyer@example.com" });
  });

  it("rejects cross-origin, extra-key, malformed, and oversized requests", async () => {
    expect((await POST(request({ credential: "x" }, "https://evil.test"))).status).toBe(403);
    expect((await POST(request({ credential: "x", extra: true }))).status).toBe(400);
    expect((await POST(request({ credential: 42 }))).status).toBe(400);
    const oversized = await POST(new NextRequest("https://doodle.samistudio.nl/api/native/auth/google", {
      method: "POST",
      headers: { origin: "https://doodle.samistudio.nl", "content-type": "application/json" },
      body: JSON.stringify({ credential: "x".repeat(8_200) }),
    }));
    expect(oversized.status).toBe(413);
    expect(mocks.verifyGoogleCredential).not.toHaveBeenCalled();
  });

  it("maps invalid credentials and backend failures without details", async () => {
    mocks.verifyGoogleCredential.mockRejectedValueOnce(new Error("invalid"));
    expect(await (await POST(request({ credential: "x" }))).json()).toEqual({ error: "invalid_credential" });
    mocks.createNativeSession.mockRejectedValueOnce(new Error("redis secret"));
    const response = await POST(request({ credential: "x" }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "auth_unavailable" });
  });
});
