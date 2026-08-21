import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  finalizeFreeDoodle,
  getFreeRemaining,
  getTrialIdentity,
  releaseFreeDoodle,
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
    redisResult.mockReset();
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

  it("requires the signing secret even when no trial cookie exists", () => {
    vi.stubEnv("SESSION_SECRET", "");

    expect(() => getTrialIdentity(new NextRequest("https://doodle.test"))).toThrow("SESSION_SECRET is required");
  });

  it("reserves one of two expiring hold slots without incrementing permanent usage", async () => {
    redisResult.mockResolvedValueOnce([1, 1]).mockResolvedValueOnce([1, 0]).mockResolvedValueOnce([0, 0]);
    const identity = getTrialIdentity(new NextRequest("https://doodle.test"));

    await expect(reserveFreeDoodle(identity, "one")).resolves.toMatchObject({ reserved: true, remaining: 1 });
    await expect(reserveFreeDoodle(identity, "two")).resolves.toMatchObject({ reserved: true, remaining: 0 });
    await expect(reserveFreeDoodle(identity, "three")).resolves.toMatchObject({ reserved: false, remaining: 0 });

    const command = JSON.parse(String(vi.mocked(globalThis.fetch).mock.calls[0][1]?.body));
    expect(command.slice(0, 3)).toEqual(["EVAL", expect.stringContaining("ZADD"), "3"]);
    expect(command[1]).toContain("ZREMRANGEBYSCORE");
    expect(command[1]).toContain("ZCARD");
    expect(command[1]).not.toContain("redis.call('INCR', KEYS[1])");
    expect(command.slice(3, 6)).toEqual([
      `doodle:trial:used:${identity.id}`,
      `doodle:trial:holds:${identity.id}`,
      `doodle:trial:finalized:${identity.id}:one`,
    ]);
    expect(command.at(-1)).toBe(600);
  });

  it("fails closed for an impossible successful reservation response", async () => {
    redisResult.mockResolvedValueOnce([1, 2]);
    const identity = getTrialIdentity(new NextRequest("https://doodle.test"));

    await expect(reserveFreeDoodle(identity, "one")).rejects.toThrow("Redis");
  });

  it("finalizes one live hold into permanent usage and returns permanent remaining", async () => {
    redisResult.mockResolvedValueOnce([1, 1]).mockResolvedValueOnce([1, 1]);
    const identity = getTrialIdentity(new NextRequest("https://doodle.test"));

    await expect(finalizeFreeDoodle(identity, "one")).resolves.toEqual({ finalized: true, remaining: 1 });
    await expect(finalizeFreeDoodle(identity, "one")).resolves.toEqual({ finalized: true, remaining: 1 });

    const command = JSON.parse(String(vi.mocked(globalThis.fetch).mock.calls[0][1]?.body));
    expect(command.slice(0, 3)).toEqual(["EVAL", expect.stringContaining("ZREM"), "3"]);
    expect(command[1]).toContain("ZREMRANGEBYSCORE");
    expect(command[1]).toContain("INCR");
    expect(command.slice(3, 6)).toEqual([
      `doodle:trial:used:${identity.id}`,
      `doodle:trial:holds:${identity.id}`,
      `doodle:trial:finalized:${identity.id}:one`,
    ]);
    expect(command.at(-1)).toBe(31_536_000);
  });

  it("releases only an active hold so release failure can at worst block until expiry", async () => {
    redisResult.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    const identity = getTrialIdentity(new NextRequest("https://doodle.test"));

    await expect(releaseFreeDoodle(identity, "one")).resolves.toBe(1);
    await expect(releaseFreeDoodle(identity, "one")).resolves.toBe(0);

    const command = JSON.parse(String(vi.mocked(globalThis.fetch).mock.calls[0][1]?.body));
    expect(command[1]).toContain("ZREMRANGEBYSCORE");
    expect(command[1]).toContain("ZREM");
    expect(command[1]).not.toContain("SET', KEYS[1]");
    expect(command.slice(2, 4)).toEqual(["1", `doodle:trial:holds:${identity.id}`]);
  });

  it("fails closed on malformed or unsuccessful Redis responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("no", { status: 503 }));
    const identity = getTrialIdentity(new NextRequest("https://doodle.test"));

    await expect(getFreeRemaining(identity)).rejects.toThrow("Redis");
    redisResult.mockResolvedValueOnce({ reserved: true });
    await expect(reserveFreeDoodle(identity, "one")).rejects.toThrow("Redis");
    redisResult.mockResolvedValueOnce("no");
    await expect(finalizeFreeDoodle(identity, "one")).rejects.toThrow("Redis");
    redisResult.mockResolvedValueOnce([1, 3]);
    await expect(finalizeFreeDoodle(identity, "one")).rejects.toThrow("Redis");
    redisResult.mockResolvedValueOnce(" ");
    await expect(getFreeRemaining(identity)).rejects.toThrow("Redis");
  });
});
