import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  finalizeFreeDoodle,
  getFreeRemaining,
  getTrialIdentity,
  refundFreeDoodle,
  reserveFreeDoodle,
  setTrialCookie,
} from "./free-allowance";

function requestWithCookie(value: string) {
  return new NextRequest("https://doodle.test", { headers: { cookie: `doodle_trial=${value}` } });
}

describe("free allowance", () => {
  const redisResult = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("SESSION_SECRET", "test-secret");
    vi.stubEnv("KV_REST_API_URL", "https://redis.example");
    vi.stubEnv("KV_REST_API_TOKEN", "token");
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify({ result: await redisResult() }), { status: 200 }),
    );
  });

  it("issues and verifies a signed opaque browser id", () => {
    const identity = getTrialIdentity(new NextRequest("https://doodle.test"));
    const response = NextResponse.json({ ok: true });
    setTrialCookie(response, identity);
    const cookie = response.cookies.get("doodle_trial");
    const value = cookie?.value;

    expect(value).toMatch(/^[0-9a-f-]+\.[A-Za-z0-9_-]+$/);
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 31_536_000 });
    expect(getTrialIdentity(requestWithCookie(value!)).id).toBe(identity.id);
  });

  it("replaces a browser id with an invalid signature", () => {
    const identity = getTrialIdentity(new NextRequest("https://doodle.test"));
    const response = NextResponse.json({ ok: true });
    setTrialCookie(response, identity);
    const [id, signature] = response.cookies.get("doodle_trial")!.value.split(".");

    expect(getTrialIdentity(requestWithCookie(`${id}.${signature}x`)).id).not.toBe(identity.id);
  });

  it("allows exactly two reservations", async () => {
    redisResult.mockResolvedValueOnce([1, 1]).mockResolvedValueOnce([1, 0]).mockResolvedValueOnce([0, 0]);
    const identity = getTrialIdentity(new NextRequest("https://doodle.test"));

    await expect(reserveFreeDoodle(identity, "one")).resolves.toMatchObject({ reserved: true, remaining: 1 });
    await expect(reserveFreeDoodle(identity, "two")).resolves.toMatchObject({ reserved: true, remaining: 0 });
    await expect(reserveFreeDoodle(identity, "three")).resolves.toMatchObject({ reserved: false, remaining: 0 });
  });

  it("refunds a failed reservation once", async () => {
    redisResult.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    const identity = getTrialIdentity(new NextRequest("https://doodle.test"));

    await expect(refundFreeDoodle(identity, "one")).resolves.toBe(1);
    await expect(refundFreeDoodle(identity, "one")).resolves.toBe(0);
  });

  it("fails closed on malformed or unsuccessful Redis responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("no", { status: 503 }));
    const identity = getTrialIdentity(new NextRequest("https://doodle.test"));

    await expect(getFreeRemaining(identity)).rejects.toThrow("Redis");
    redisResult.mockResolvedValueOnce({ reserved: true });
    await expect(reserveFreeDoodle(identity, "one")).rejects.toThrow("Redis");
    redisResult.mockResolvedValueOnce("no");
    await expect(finalizeFreeDoodle(identity, "one")).rejects.toThrow("Redis");
    redisResult.mockResolvedValueOnce(" ");
    await expect(getFreeRemaining(identity)).rejects.toThrow("Redis");
  });
});
