// @vitest-environment node
import { execFile, spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import { promisify } from "node:util";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { processPlayPurchase, type ProductPurchaseV2 } from "./billing/play-purchase";
import { fulfillCreditPack } from "./billing/credits";
import { recordUsage, trackUsage } from "./usage-metrics";

vi.mock("server-only", () => ({}));
const callbacks = vi.hoisted(() => [] as Array<() => Promise<unknown>>);
vi.mock("next/server", () => ({ after: (callback: () => Promise<unknown>) => callbacks.push(callback) }));
const exec = promisify(execFile);
const available = spawnSync("redis-server", ["--version"], { stdio: "ignore" }).status === 0;
const account = "11111111-1111-4111-8111-111111111111";
const purchase: ProductPurchaseV2 = {
  purchaseStateContext: { purchaseState: "PURCHASED" },
  obfuscatedExternalAccountId: "bound-account",
  productLineItem: [{ productId: "doodle_credits_10", productOfferDetails: {
    quantity: 1, refundableQuantity: 1, consumptionState: "CONSUMPTION_STATE_YET_TO_BE_CONSUMED",
  } }],
};
let port: number;
let dataDir: string;
let process: ChildProcess;
async function redis(command: unknown[]) {
  const result = await exec("redis-cli", ["-p", String(port), "--json", ...command.map(String)]);
  return JSON.parse(result.stdout.trim());
}
async function flushCallbacks() {
  while (callbacks.length) await callbacks.shift()!();
}

(available ? describe : describe.skip)("daily usage against isolated Redis", () => {
  beforeAll(async () => {
    const server = createServer();
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as { port: number }).port;
    await new Promise<void>(resolve => server.close(() => resolve()));
    dataDir = mkdtempSync(`${tmpdir()}/doodle-metrics-`);
    process = spawn("redis-server", ["--bind", "127.0.0.1", "--port", String(port), "--dir", dataDir, "--save", "", "--appendonly", "no"], { stdio: "ignore" });
    for (let i = 0; i < 50; i++) {
      try { if (await redis(["PING"]) === "PONG") return; } catch {}
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error("Isolated Redis failed to start");
  });
  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T22:30:00Z"));
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("KV_REST_API_URL", "http://isolated-redis.test");
    vi.stubEnv("KV_REST_API_TOKEN", "local-only");
    callbacks.length = 0;
    await redis(["FLUSHDB"]);
    await redis(["SET", `doodle:account:${account}:active`, "1"]);
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, options) => {
      return new Response(JSON.stringify({ result: await redis(JSON.parse(String(options?.body))) }));
    });
  });
  afterAll(async () => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    process.kill("SIGTERM");
    await new Promise<void>(resolve => process.once("exit", () => resolve()));
    rmSync(dataDir, { recursive: true, force: true });
  });
  function play(value = purchase, email = "buyer@example.com") {
    return processPlayPurchase({ accountId: account, email, expectedObfuscatedAccountId: "bound-account",
      purchaseToken: "local-test-purchase-token", productId: "doodle_credits_10",
      publisher: { getProductPurchase: async () => value, consumeProductPurchase: async () => {} } });
  }
  it("counts a concurrent Play pack once without changing its credit grant", async () => {
    await Promise.all(Array.from({ length: 4 }, () => play()));
    expect(await redis(["GET", `doodle:account:${account}:balance`])).toBe("10");
    expect(await redis(["HGET", "doodle:metrics:day:2026-10-02", "purchases:android"])).toBe(null);
    await flushCallbacks();
    expect(await redis(["HGET", "doodle:metrics:day:2026-10-02", "purchases:android"])).toBe("1");
  });
  it("delivers test-card credits without counting a real purchase", async () => {
    await play({ ...purchase, testPurchaseContext: { fopType: "TEST" } });
    await flushCallbacks();
    expect(await redis(["GET", `doodle:account:${account}:balance`])).toBe("10");
    expect(await redis(["HGET", "doodle:metrics:day:2026-10-02", "purchases:android"])).toBe(null);
  });
  it("excludes the owner from counts and registers their account as QA", async () => {
    await play(purchase, "SamiCodesIt@gmail.com");
    await flushCallbacks();
    expect(await redis(["HGET", "doodle:metrics:day:2026-10-02", "purchases:android"])).toBe(null);
    expect(await redis(["SCARD", "doodle:metrics:qa"])).toBe(1);
    expect(await redis(["GET", `doodle:account:${account}:balance`])).toBe("10");
  });
  it("counts a Stripe pack once and does not recount next-day webhook replay", async () => {
    await fulfillCreditPack(account, "cs_real", "pi_real", { isTest: false, email: "buyer@example.com" });
    await flushCallbacks();
    vi.setSystemTime(new Date("2026-10-02T22:30:00Z"));
    await fulfillCreditPack(account, "cs_real", "pi_real", { isTest: false, email: "buyer@example.com" });
    await flushCallbacks();
    expect(await redis(["HGET", "doodle:metrics:day:2026-10-02", "purchases:web"])).toBe("1");
    expect(await redis(["HGET", "doodle:metrics:day:2026-10-03", "purchases:web"])).toBe(null);
    expect(await redis(["GET", `doodle:account:${account}:balance`])).toBe("10");
  });
  it("keeps purchase delivery successful when counting storage fails", async () => {
    await play();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("metrics offline"));
    await expect(flushCallbacks()).resolves.toBeUndefined();
    expect(await redis(["GET", `doodle:account:${account}:balance`])).toBe("10");
  });
  it("does not collect counts in a preview deployment", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    await play();
    await flushCallbacks();
    expect(await redis(["KEYS", "doodle:metrics:*"])).toEqual([]);
  });
  it("deduplicates drawing events across races and Amsterdam day boundaries", async () => {
    const event = { metric: "drawings", channel: "android", id: "drawing-one", actor: "trial:anonymous" } as const;
    await Promise.all(Array.from({ length: 8 }, () => recordUsage(event)));
    vi.setSystemTime(new Date("2026-10-02T22:30:00Z"));
    await recordUsage(event);
    expect(await redis(["HGET", "doodle:metrics:day:2026-10-02", "drawings:android"])).toBe("1");
    expect(await redis(["HGET", "doodle:metrics:day:2026-10-03", "drawings:android"])).toBe(null);
    const ttl = await redis(["TTL", "doodle:metrics:day:2026-10-02"]);
    expect(ttl).toBeGreaterThan(365 * 86_400);
    expect(ttl).toBeLessThanOrEqual(366 * 86_400);
  });
  it("keeps only aggregate values and hashed identifiers in storage", async () => {
    await recordUsage({ metric: "drawings", channel: "web", id: "private-receipt", actor: "account:private-account", email: "buyer@example.com" });
    const keys: string[] = await redis(["KEYS", "doodle:metrics:*"]);
    expect(keys).toHaveLength(2);
    expect(keys.join(" ")).not.toMatch(/private-receipt|private-account|buyer@example/);
    expect(await redis(["HGETALL", "doodle:metrics:day:2026-10-02"])).toEqual({ "drawings:web": "1" });
  });
  it("keeps a QA account excluded when later calls omit its email", async () => {
    await play(purchase, "doodlereview889@gmail.com");
    await flushCallbacks();
    await recordUsage({ metric: "drawings", channel: "android", id: "qa-drawing", actor: `account:${account}` });
    expect(await redis(["KEYS", "doodle:metrics:day:*"])).toEqual([]);
  });
  it("uses the drawing's response day even if the background callback runs after midnight", async () => {
    vi.setSystemTime(new Date("2026-10-01T21:59:59Z"));
    trackUsage({ metric: "drawings", channel: "web", id: "before-midnight", actor: "trial:anonymous" });
    vi.setSystemTime(new Date("2026-10-01T22:00:01Z"));
    await flushCallbacks();
    expect(await redis(["HGET", "doodle:metrics:day:2026-10-01", "drawings:web"])).toBe("1");
    expect(await redis(["HGET", "doodle:metrics:day:2026-10-02", "drawings:web"])).toBe(null);
  });
});
