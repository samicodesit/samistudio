const mergeFunnel = vi.hoisted(()=>vi.fn().mockResolvedValue(undefined));
const deleteFunnel = vi.hoisted(()=>vi.fn().mockResolvedValue(undefined));
vi.mock("@/lib/funnel-metrics",()=>({deleteFunnelIdentity:deleteFunnel,mergeFunnelIdentity:mergeFunnel}));
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET } from "./route";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  clearSessionCookie: vi.fn(),
  deletePaidAccount: vi.fn(),
  getCurrentUser: vi.fn(),
  getFreeRemaining: vi.fn(),
  getPaidBalance: vi.fn(),
  getPurchaseHistory: vi.fn(),
  revokeNativeSession: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser, clearSessionCookie: mocks.clearSessionCookie }));
vi.mock("@/lib/billing/credits", () => ({ getPaidBalance: mocks.getPaidBalance, getPurchaseHistory: mocks.getPurchaseHistory, deletePaidAccount: mocks.deletePaidAccount }));
vi.mock("@/lib/native-session", () => ({ revokeNativeSession: mocks.revokeNativeSession }));
vi.mock("@/lib/generation/free-allowance", async () => {
  const actual = await vi.importActual<typeof import("@/lib/generation/free-allowance")>(
    "@/lib/generation/free-allowance",
  );
  return { ...actual, getFreeRemaining: mocks.getFreeRemaining };
});

function request(
  method: "GET" | "DELETE" = "GET",
  body?: unknown,
  origin = "https://doodle.test",
  extraHeaders: Record<string, string> = {},
) {
  return new NextRequest("https://doodle.test/api/account", {
    method,
    headers: { host: "doodle.test", origin, "content-type": "application/json", ...extraHeaders },
    body: method === "DELETE" && body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("account route", () => {
  beforeEach(() => {
    deleteFunnel.mockReset().mockResolvedValue(undefined);
    vi.unstubAllEnvs();
    vi.stubEnv("SESSION_SECRET", "account-route-test-secret");
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getFreeRemaining.mockResolvedValue(2);
    mocks.deletePaidAccount.mockResolvedValue(undefined);
    mocks.revokeNativeSession.mockResolvedValue(undefined);
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

  it("reports paid and remaining browser trial usage after sign-in", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user", identityKey: "a".repeat(64), email: "buyer@example.com" });
    mocks.getPaidBalance.mockResolvedValue(7);

    const response = await GET(request());

    expect(await response.json()).toEqual({
      authenticated: true,
      email: "buyer@example.com",
      balance: 7,
      freeRemaining: 2,
    });
    expect(response.headers.get("set-cookie")).toContain("doodle_trial=");
    expect(mocks.getFreeRemaining).toHaveBeenCalledTimes(1);
  });

  it("keeps the same browser trial identity across sign-in without resetting usage", async () => {
    mocks.getCurrentUser.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "user", email: "buyer@example.com" });
    mocks.getPaidBalance.mockResolvedValue(0);
    const before = await GET(request());
    const cookie = before.headers.get("set-cookie")!.split(";")[0];
    const after = await GET(request("GET", undefined, "https://doodle.test", { cookie }));
    expect(await after.json()).toMatchObject({ authenticated: true, balance: 0, freeRemaining: 2 });
    expect(mocks.getFreeRemaining.mock.calls[1][0]).toEqual(mocks.getFreeRemaining.mock.calls[0][0]);
  });

  it("does not expose a browser trial to authenticated native Android requests", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user", identityKey: "a".repeat(64), email: "buyer@example.com" });
    mocks.getPaidBalance.mockResolvedValue(0);
    const response = await GET(request("GET", undefined, "https://doodle.test", {
      "x-doodle-client": "native-android", authorization: `Bearer ${"t".repeat(43)}`,
    }));
    expect(await response.json()).toMatchObject({ balance: 0, freeRemaining: null });
    expect(mocks.getFreeRemaining).not.toHaveBeenCalled();
  });

  it("returns purchase history for native clients separately from the current balance", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user", email: "buyer@example.com" });
    mocks.getPaidBalance.mockResolvedValue(0);
    mocks.getPurchaseHistory.mockResolvedValue(true);
    const response = await GET(request("GET", undefined, "https://doodle.test", { "x-doodle-client": "native-android" }));
    expect(await response.json()).toMatchObject({ balance: 0, hasPurchased: true });
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
    expect(deleteFunnel).not.toHaveBeenCalled();
    expect(mocks.deletePaidAccount).toHaveBeenCalledWith("user", "a".repeat(64));
    expect(mocks.clearSessionCookie).toHaveBeenCalledWith(response);
    expect(mocks.revokeNativeSession).toHaveBeenCalledWith(expect.any(NextRequest));
  });

  it("does not depend on a separate metrics request to delete the account", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user", identityKey: "a".repeat(64), email: "buyer@example.com" });
    deleteFunnel.mockRejectedValue(new Error("Metrics timeout"));
    const response = await DELETE(request("DELETE", { confirm: true }));
    expect(response.status).toBe(204);
    expect(deleteFunnel).not.toHaveBeenCalled();
    expect(mocks.deletePaidAccount).toHaveBeenCalledOnce();
    expect(mocks.revokeNativeSession).toHaveBeenCalledOnce();
    expect(mocks.clearSessionCookie).toHaveBeenCalledWith(response);
  });

  it("revokes the native bearer as part of account deletion", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user", identityKey: "a".repeat(64), email: "buyer@example.com" });
    const requestWithBearer = request("DELETE", { confirm: true }, "https://doodle.test", {
      authorization: `Bearer ${"t".repeat(43)}`,
    });

    const response = await DELETE(requestWithBearer);

    expect(response.status).toBe(204);
    expect(mocks.revokeNativeSession).toHaveBeenCalledWith(requestWithBearer);
  });

  it("does not report success when Redis rejects deletion", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user", identityKey: "a".repeat(64), email: "buyer@example.com" });
    mocks.deletePaidAccount.mockRejectedValue(new Error("Redis unavailable"));

    const response = await DELETE(request("DELETE", { confirm: true }));

    expect(response.status).toBe(500);
  });
});

it("merges the retained trial on a same-site web account refresh after redirect sign-in",async()=>{
 vi.stubEnv("SESSION_SECRET","account-route-test-secret");mocks.getCurrentUser.mockResolvedValue({id:"account",email:"buyer@example.com"});mocks.getPaidBalance.mockResolvedValue(0);mocks.getFreeRemaining.mockResolvedValue(0);mocks.getPurchaseHistory.mockResolvedValue(false);
 const trial="11111111-1111-4111-8111-111111111111", signature=createHmac("sha256","account-route-test-secret").update(trial).digest("base64url");
 const response=await GET(request("GET",undefined,"https://doodle.test",{"x-doodle-packs":"v1",cookie:"doodle_trial="+trial+"."+signature}));expect(response.status).toBe(200);expect(mergeFunnel).toHaveBeenCalledWith("trial:"+trial,"account:account","buyer@example.com");
});
