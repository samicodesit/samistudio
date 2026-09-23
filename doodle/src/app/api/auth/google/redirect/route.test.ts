import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  verifyGoogleCredential: vi.fn(),
  createOrGetGoogleAccount: vi.fn(),
  setSessionCookie: vi.fn(),
}));
vi.mock("@/lib/auth/google", () => ({ verifyGoogleCredential: mocks.verifyGoogleCredential }));
vi.mock("@/lib/auth/accounts", () => ({ createOrGetGoogleAccount: mocks.createOrGetGoogleAccount }));
vi.mock("@/lib/auth/session", () => ({ setSessionCookie: mocks.setSessionCookie }));

function request(fields: Record<string, string>, cookie?: string) {
  return new NextRequest("https://doodle.test/api/auth/google/redirect", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      ...(cookie ? { cookie } : {}),
      origin: "https://accounts.google.com",
    },
    body: new URLSearchParams(fields).toString(),
  });
}

function locationOf(response: Response) {
  return response.headers.get("location");
}

describe("Google redirect auth route", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  it("accepts Google's cross-site form with a matching double-submit CSRF token", async () => {
    mocks.verifyGoogleCredential.mockResolvedValue({ sub: "google-sub", email: "buyer@example.com" });
    mocks.createOrGetGoogleAccount.mockResolvedValue({ id: "a6c1f149-6239-4b77-8d3f-7a0574bb5f40", identityKey: "a".repeat(64) });

    const response = await POST(request({ credential: "google-token", g_csrf_token: "csrf-token" }, "g_csrf_token=csrf-token"));

    expect(response.status).toBe(303);
    expect(locationOf(response)).toBe("https://doodle.samistudio.nl/?auth=success");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.verifyGoogleCredential).toHaveBeenCalledWith("google-token");
    expect(mocks.setSessionCookie).toHaveBeenCalledWith(response, {
      id: "a6c1f149-6239-4b77-8d3f-7a0574bb5f40",
      identityKey: "a".repeat(64),
      email: "buyer@example.com",
    });
    expect(locationOf(response)).not.toContain("google-token");
  });

  it("rejects a missing or mismatched double-submit CSRF token before verification", async () => {
    const response = await POST(request({ credential: "google-token", g_csrf_token: "wrong-token" }, "g_csrf_token=csrf-token"));

    expect(response.status).toBe(303);
    expect(locationOf(response)).toBe("https://doodle.samistudio.nl/?auth=error");
    expect(mocks.verifyGoogleCredential).not.toHaveBeenCalled();
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
  });

  it("redirects invalid credentials without leaking the credential", async () => {
    mocks.verifyGoogleCredential.mockRejectedValue(new Error("invalid credential"));

    const response = await POST(request({ credential: "google-token", g_csrf_token: "csrf-token" }, "g_csrf_token=csrf-token"));

    expect(response.status).toBe(303);
    expect(locationOf(response)).toBe("https://doodle.samistudio.nl/?auth=error");
    expect(locationOf(response)).not.toContain("google-token");
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
  });

  it("redirects malformed forms and account failures as controlled auth errors", async () => {
    const malformed = await POST(request({ g_csrf_token: "csrf-token" }, "g_csrf_token=csrf-token"));
    expect(malformed.status).toBe(303);
    expect(locationOf(malformed)).toBe("https://doodle.samistudio.nl/?auth=error");

    mocks.verifyGoogleCredential.mockResolvedValue({ sub: "google-sub", email: "buyer@example.com" });
    mocks.createOrGetGoogleAccount.mockRejectedValue(new Error("Redis unavailable"));
    const unavailable = await POST(request({ credential: "google-token", g_csrf_token: "csrf-token" }, "g_csrf_token=csrf-token"));
    expect(unavailable.status).toBe(303);
    expect(locationOf(unavailable)).toBe("https://doodle.samistudio.nl/?auth=error");
  });
});
