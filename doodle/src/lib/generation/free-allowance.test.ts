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

  it("allows exactly two reservations with a recognizable reserved marker", async () => {
    redisResult.mockResolvedValueOnce([1, 1]).mockResolvedValueOnce([1, 0]).mockResolvedValueOnce([0, 0]);
    const identity = getTrialIdentity(new NextRequest("https://doodle.test"));

    await expect(reserveFreeDoodle(identity, "one")).resolves.toMatchObject({ reserved: true, remaining: 1 });
    await expect(reserveFreeDoodle(identity, "two")).resolves.toMatchObject({ reserved: true, remaining: 0 });
    await expect(reserveFreeDoodle(identity, "three")).resolves.toMatchObject({ reserved: false, remaining: 0 });

    const command = JSON.parse(String(vi.mocked(globalThis.fetch).mock.calls[0][1]?.body));
    expect(command.slice(0, 3)).toEqual(["EVAL", expect.stringContaining("'reserved'"), "2"]);
    expect(command.slice(3)).toEqual([
      `doodle:trial:used:${identity.id}`,
      `doodle:trial:reservation:${identity.id}:one`,
      31_536_000,
    ]);
  });

  it("fails closed for an impossible successful reservation response", async () => {
    redisResult.mockResolvedValueOnce([1, 2]);
    const identity = getTrialIdentity(new NextRequest("https://doodle.test"));

    await expect(reserveFreeDoodle(identity, "one")).rejects.toThrow("Redis");
  });

  it("finalizes once into a five-minute compensatable tombstone", async () => {
    redisResult.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    const identity = getTrialIdentity(new NextRequest("https://doodle.test"));

    await expect(finalizeFreeDoodle(identity, "one")).resolves.toBe(1);
    await expect(finalizeFreeDoodle(identity, "one")).resolves.toBe(0);

    const command = JSON.parse(String(vi.mocked(globalThis.fetch).mock.calls[0][1]?.body));
    expect(command.slice(0, 3)).toEqual(["EVAL", expect.stringContaining("'finalized'"), "1"]);
    expect(command[1]).toContain("~= 'reserved'");
    expect(command.slice(3)).toEqual([`doodle:trial:reservation:${identity.id}:one`, 300]);
  });

  it("refunds either reserved or finalized state once", async () => {
    redisResult.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    const identity = getTrialIdentity(new NextRequest("https://doodle.test"));

    await expect(refundFreeDoodle(identity, "one")).resolves.toBe(1);
    await expect(refundFreeDoodle(identity, "one")).resolves.toBe(0);

    const command = JSON.parse(String(vi.mocked(globalThis.fetch).mock.calls[0][1]?.body));
    expect(command[1]).toContain("state ~= 'reserved' and state ~= 'finalized'");
    expect(command.slice(2)).toEqual([
      "2",
      `doodle:trial:used:${identity.id}`,
      `doodle:trial:reservation:${identity.id}:one`,
      31_536_000,
    ]);
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
