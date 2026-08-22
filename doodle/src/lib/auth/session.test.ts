import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSessionCookie, getCurrentUser, setSessionCookie } from "./session";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ cookies: vi.fn(), isPaidAccountActive: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/billing/credits", () => ({ isPaidAccountActive: mocks.isPaidAccountActive }));

const USER = {
  id: "a6c1f149-6239-4b77-8d3f-7a0574bb5f40",
  identityKey: "a".repeat(64),
  email: "buyer@example.com",
};

function cookieFor(payload: object) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", "session-secret").update(body).digest("base64url");
  return `${body}.${signature}`;
}

describe("Doodle session", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("SESSION_SECRET", "session-secret");
    mocks.cookies.mockReset();
    mocks.isPaidAccountActive.mockReset();
    mocks.cookies.mockResolvedValue({ get: () => undefined });
  });

  it("sets a signed, secure session cookie and restores an active account", async () => {
    const response = NextResponse.json({ ok: true });
    setSessionCookie(response, USER);
    const value = response.cookies.get("doodle_session")?.value;
    mocks.cookies.mockResolvedValue({ get: () => ({ value }) });
    mocks.isPaidAccountActive.mockResolvedValue(true);

    await expect(getCurrentUser()).resolves.toEqual(USER);
    expect(response.cookies.get("doodle_session")).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 2_592_000 });
  });

  it.each([
    ["missing", undefined],
    ["tampered", `${cookieFor({ ...USER, exp: Math.floor(Date.now() / 1000) + 60 })}x`],
    ["expired", cookieFor({ ...USER, exp: 1 })],
    ["malformed email", cookieFor({ ...USER, email: "not an email", exp: Math.floor(Date.now() / 1000) + 60 })],
    ["malformed id", cookieFor({ ...USER, id: "user", exp: Math.floor(Date.now() / 1000) + 60 })],
  ])("does not restore a %s session", async (_name, value) => {
    mocks.cookies.mockResolvedValue({ get: () => (value ? { value } : undefined) });

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(mocks.isPaidAccountActive).not.toHaveBeenCalled();
  });

  it("rejects a valid-but-inactive account and lets Redis errors propagate", async () => {
    mocks.cookies.mockResolvedValue({ get: () => ({ value: cookieFor({ ...USER, exp: Math.floor(Date.now() / 1000) + 60 }) }) });
    mocks.isPaidAccountActive.mockResolvedValueOnce(false).mockRejectedValueOnce(new Error("Redis unavailable"));

    await expect(getCurrentUser()).resolves.toBeNull();
    await expect(getCurrentUser()).rejects.toThrow("Redis unavailable");
  });

  it("expires the cookie on sign-out", () => {
    const response = new NextResponse(null, { status: 204 });
    clearSessionCookie(response);

    expect(response.cookies.get("doodle_session")).toMatchObject({ maxAge: 0, httpOnly: true, sameSite: "lax", path: "/" });
  });
});
