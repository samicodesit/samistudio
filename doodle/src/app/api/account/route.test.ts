import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET } from "./route";

const mocks = vi.hoisted(() => ({
  clearSessionCookie: vi.fn(),
  deletePaidAccount: vi.fn(),
  getCurrentUser: vi.fn(),
  getFreeRemaining: vi.fn(),
  getPaidBalance: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser, clearSessionCookie: mocks.clearSessionCookie }));
vi.mock("@/lib/billing/credits", () => ({ getPaidBalance: mocks.getPaidBalance, deletePaidAccount: mocks.deletePaidAccount }));
vi.mock("@/lib/generation/free-allowance", async () => {
  const actual = await vi.importActual<typeof import("@/lib/generation/free-allowance")>(
    "@/lib/generation/free-allowance",
  );
  return { ...actual, getFreeRemaining: mocks.getFreeRemaining };
});

function request(method: "GET" | "DELETE" = "GET", body?: unknown, origin = "https://doodle.test") {
  return new NextRequest("https://doodle.test/api/account", {
    method,
    headers: { host: "doodle.test", origin, "content-type": "application/json" },
    body: method === "DELETE" && body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("account route", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("SESSION_SECRET", "account-route-test-secret");
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.deletePaidAccount.mockResolvedValue(undefined);
  });

  it("reports anonymous free usage with a signed trial cookie and no caching", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    mocks.getFreeRemaining.mockResolvedValue(2);

    const response = await GET(request());

    expect(await response.json()).toEqual({
      authenticated: false,
      email: null,
      balance: 0,
      freeRemaining: 2,
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    const setCookie = response.headers.get("set-cookie") ?? "";
    const value = /^doodle_trial=([^;]+)/.exec(setCookie)?.[1];
    const [id, signature] = value?.split(".") ?? [];
    expect(id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(signature).toBe(
      createHmac("sha256", "account-route-test-secret").update(id).digest("base64url"),
    );
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=lax");
    expect(mocks.getPaidBalance).not.toHaveBeenCalled();
  });

  it("reports the signed-in paid balance without reading anonymous usage", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user", identityKey: "a".repeat(64), email: "buyer@example.com" });
    mocks.getPaidBalance.mockResolvedValue(7);

    const response = await GET(request());

    expect(await response.json()).toEqual({
      authenticated: true,
      email: "buyer@example.com",
      balance: 7,
      freeRemaining: null,
    });
    expect(response.headers.get("set-cookie")).toContain("doodle_trial=");
    expect(mocks.getFreeRemaining).not.toHaveBeenCalled();
  });

  it("rejects cross-origin deletion before authentication", async () => {
    const response = await DELETE(request("DELETE", { confirm: true }, "https://evil.test"));

    expect(response.status).toBe(403);
    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
    expect(mocks.deletePaidAccount).not.toHaveBeenCalled();
  });

  it("requires an explicit irreversible-deletion confirmation", async () => {
    const response = await DELETE(request("DELETE", { confirm: false }));

    expect(response.status).toBe(400);
    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
    expect(mocks.deletePaidAccount).not.toHaveBeenCalled();
  });

  it("requires authentication before deleting an account", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const response = await DELETE(request("DELETE", { confirm: true }));

    expect(response.status).toBe(401);
    expect(mocks.deletePaidAccount).not.toHaveBeenCalled();
  });

  it("deletes the authenticated account and expires its session", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user", identityKey: "a".repeat(64), email: "buyer@example.com" });

    const response = await DELETE(request("DELETE", { confirm: true }));

    expect(response.status).toBe(204);
    expect(mocks.deletePaidAccount).toHaveBeenCalledWith("user", "a".repeat(64));
    expect(mocks.clearSessionCookie).toHaveBeenCalledWith(response);
  });

  it("does not report success when Redis rejects deletion", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user", identityKey: "a".repeat(64), email: "buyer@example.com" });
    mocks.deletePaidAccount.mockRejectedValue(new Error("Redis unavailable"));

    const response = await DELETE(request("DELETE", { confirm: true }));

    expect(response.status).toBe(500);
  });
});
