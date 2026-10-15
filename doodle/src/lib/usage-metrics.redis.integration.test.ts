import { fulfillStripePack, refundStripePack } from "./billing/web-pack-ledger";
// @vitest-environment node
import { execFile, spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import { promisify } from "node:util";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { processPlayPurchase, type ProductPurchaseV2 } from "./billing/play-purchase";
import { deletePaidAccount, fulfillCreditPack, finalizePaidCredit, reservePaidCredit } from "./billing/credits";
import { recordOperation, recordUsage, trackUsage } from "./usage-metrics";
import { recordFunnel, mergeFunnelIdentity, readFunnel, deleteFunnelIdentity } from "./funnel-metrics";
import { createHash } from "node:crypto";
async function grantComplimentaryCredits(accountId: string, input: { grantId: string; credits: number; reason: string }) {
  return (await import("./billing/complimentary-credits")).grantComplimentaryCredits(accountId, input);
}

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
  it("counts unique funnel identities across days and merges the signed-in guest", async () => {
    await recordFunnel({metric:"first_doodle",actor:"trial:guest"});
    await recordFunnel({metric:"paywall_hit",actor:"trial:guest",trigger:"get_more"});
    await recordFunnel({metric:"paywall_hit",actor:"account:"+account,trigger:"tapped_create"});
    await mergeFunnelIdentity("trial:guest","account:"+account);
    await recordFunnel({metric:"first_doodle",actor:"account:"+account});
    await recordFunnel({metric:"paywall_hit",actor:"trial:guest",trigger:"get_more"},new Date("2026-10-03T12:00:00Z"));
    expect(await readFunnel(["2026-10-02","2026-10-03"])).toMatchObject({regular:{first_doodle:1,paywall_hit:1}});
  });
  it("deletes account funnel identities and guest aliases in the account deletion transaction", async () => {
    const prefix = "doodle:metrics:funnel:";
    const accountActor = "account:" + account;
    const trialActor = "trial:retained-guest";
    const hash = (value: string) => createHash("sha256").update(value).digest("hex");
    await recordFunnel({ metric: "first_doodle", actor: trialActor });
    await mergeFunnelIdentity(trialActor, accountActor);
    await recordFunnel({ metric: "paywall_hit", actor: accountActor, trigger: "get_more" });
    expect((await readFunnel(["2026-10-02"])).regular.first_doodle).toBe(1);
    await deletePaidAccount(account, "a".repeat(64));
    expect((await readFunnel(["2026-10-02"])).regular).toMatchObject({ first_doodle: 0, paywall_hit: 0 });
    for (const key of ["identity:" + hash(accountActor), "history:" + hash(accountActor), "aliases:" + hash(accountActor), "alias:" + hash(trialActor)]) {
      expect(await redis(["EXISTS", prefix + key])).toBe(0);
    }
    expect(await redis(["EXISTS", `doodle:account:${account}:active`])).toBe(0);
    expect(await redis(["GET", `doodle:account:${account}:deleted`])).toBe("deleted");
    // Callbacks admitted before deletion may execute after the deletion transaction.
    await recordFunnel({ metric: "first_doodle", actor: accountActor });
    await recordFunnel({ metric: "paywall_hit", actor: trialActor, trigger: "get_more" });
    await mergeFunnelIdentity("trial:late-sign-in", accountActor);
    await recordFunnel({ metric: "first_doodle", actor: "trial:late-sign-in" });
    expect(await redis(["EXISTS", prefix + "identity:" + hash(accountActor)])).toBe(0);
    expect(await redis(["EXISTS", prefix + "alias:" + hash("trial:late-sign-in")])).toBe(0);
    expect((await readFunnel(["2026-10-02"])).regular.paywall_hit).toBe(0);
  });
  it.each([["pack_mini",6],["pack_regular",20],["pack_big",60]] as const)("fulfills and reconciles %s with incremental, duplicate and out-of-order refunds",async(productId,credits)=>{
    const ref="b".repeat(64), priceId="price_pack";
    await redis(["HSET","doodle:stripe:intent:"+ref,"account",account,"productId",productId,"credits",credits,"offerApplied",0,"priceId",priceId]);
    const grant={productId,credits,offerApplied:false,priceId,reference:ref};
    await Promise.all(Array.from({length:8},()=>fulfillStripePack(account,"cs_pack","pi_pack",grant)));
    expect(await refundStripePack("cs_pack",Math.floor(credits/2))).toEqual({recovered:Math.floor(credits/2),unrecovered:0});
    expect(await refundStripePack("cs_pack",credits)).toEqual({recovered:credits,unrecovered:0});
    expect(await refundStripePack("cs_pack",1)).toEqual({recovered:credits,unrecovered:0});
    await redis(["DEL","doodle:stripe:intent:"+ref]);
    expect(await fulfillStripePack(account,"cs_pack","pi_pack",grant)).toMatchObject({balance:0,creditsGranted:credits});
    expect(await redis(["GET",`doodle:account:${account}:balance`])).toBe("0");
  });
  it("recovers an already refunded Stripe payment without exposing its credits",async()=>{
    const ref="e".repeat(64),grant={productId:"pack_regular" as const,credits:25,offerApplied:true,priceId:"price_regular",reference:ref};
    await redis(["HSET","doodle:stripe:intent:"+ref,"account",account,"productId",grant.productId,"credits",25,"offerApplied",1,"priceId",grant.priceId]);
    expect(await fulfillStripePack(account,"cs_refunded","pi_refunded",grant,undefined,25)).toMatchObject({balance:0,creditsGranted:25});
    expect(await refundStripePack("cs_refunded",25)).toEqual({recovered:25,unrecovered:0});
    expect(await redis(["GET",`doodle:account:${account}:balance`])).toBe("0");
  });
  it("does not revive an account deleted before Stripe pack fulfillment",async()=>{
    const ref="c".repeat(64), grant={productId:"pack_mini" as const,credits:6,offerApplied:false,priceId:"price_mini",reference:ref};
    await redis(["HSET","doodle:stripe:intent:"+ref,"account",account,"productId",grant.productId,"credits",6,"offerApplied",0,"priceId",grant.priceId]);
    await deletePaidAccount(account,"d".repeat(64));
    await expect(fulfillStripePack(account,"cs_deleted","pi_deleted",grant)).rejects.toThrow();
    expect(await redis(["EXISTS",`doodle:account:${account}:balance`])).toBe(0);
  });
  it("grants variable Stripe packs once and reverses the recorded quantity without consuming active holds", async () => {
    const ref = "a".repeat(64), key = "doodle:stripe:intent:"+ref;
    await redis(["HSET",key,"account",account,"productId","pack_regular","credits",25,"offerApplied",1,"priceId","price_regular"]);
    const grant = { productId: "pack_regular" as const, credits: 25, offerApplied: true, reference: ref, priceId: "price_regular" };
    const results = await Promise.all(Array.from({length:12},()=>fulfillStripePack(account,"cs_bonus","pi_bonus",grant)));
    expect(results.every(x=>x.creditsGranted===25)).toBe(true);
    expect(await redis(["GET",`doodle:account:${account}:balance`])).toBe("25");
    await expect(fulfillStripePack(account,"cs_second","pi_second",grant)).rejects.toThrow();
    await reservePaidCredit(account,"33333333-3333-4333-8333-333333333333");
    expect(await refundStripePack("cs_bonus",25)).toMatchObject({recovered:24,unrecovered:1});
    expect(await refundStripePack("cs_bonus",25)).toMatchObject({recovered:24,unrecovered:1});
    expect(await redis(["GET",`doodle:account:${account}:balance`])).toBe("1");
    const replay=await fulfillStripePack(account,"cs_bonus","pi_bonus",grant);
    expect(replay).toMatchObject({creditsGranted:25,balance:1,offerApplied:true});
  });
  it("marks uninstrumented report dates unavailable instead of inferring zero", async () => {
    const empty = await readFunnel(["2026-10-01"]);
    expect(empty).toMatchObject({ coverage: { status: "unobserved", unobservedDates: ["2026-10-01"] }, regular: { first_doodle: null }, creditsGranted: null });
    await recordFunnel({ metric: "first_doodle", actor: "trial:observed" });
    const partial = await readFunnel(["2026-10-01", "2026-10-02"]);
    expect(partial).toMatchObject({ coverage: { status: "partial", observedFrom: "2026-10-02", unobservedDates: ["2026-10-01"] }, regular: { first_doodle: 1 } });
    expect(await readFunnel(["2026-10-02"])).toMatchObject({ coverage: { status: "observed", unobservedDates: [] } });
  });
  it("excludes QA and test payments, reports gifted activity separately, and deletes membership", async () => {
    await recordFunnel({metric:"first_doodle",actor:"account:"+account,email:"samicodesit@gmail.com"});
    await recordFunnel({metric:"purchase",actor:"account:tester",id:"test-token",pack:"pack_regular",creditsGranted:25,offerApplied:true,isTest:true});
    expect(await readFunnel(["2026-10-02"])).toMatchObject({regular:{first_doodle:null}});
    const gifted="account:gifted";
    await redis(["SADD","doodle:metrics:gifted",createHash("sha256").update(gifted).digest("hex")]);
    await recordFunnel({metric:"free_exhausted",actor:gifted});
    expect(await readFunnel(["2026-10-02"])).toMatchObject({gifted:{free_exhausted:1}});
    await deleteFunnelIdentity(gifted);
    expect(await readFunnel(["2026-10-02"])).toMatchObject({gifted:{free_exhausted:0}});
  });
  it("records a verified purchase once with its actual grant", async () => {
    const event={metric:"purchase",actor:"account:"+account,id:"receipt-one",pack:"pack_regular",creditsGranted:25,offerApplied:true} as const;
    await Promise.all([recordFunnel(event),recordFunnel(event)]);
    expect(await readFunnel(["2026-10-02"])).toMatchObject({purchases:{"pack_regular:25:bonus":1},creditsGranted:25});
  });
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
  it("excludes a configured verified email across account and free-trial actors without storing the email", async () => {
    const email = "family@example.com";
    const emailHash = createHash("sha256").update(email).digest("hex");
    await redis(["SADD", "doodle:metrics:qa", `email:${emailHash}`]);
    await recordUsage({ metric: "drawings", channel: "web", id: "family-free", actor: "trial:family", email: " FAMILY@example.com " });
    await recordUsage({ metric: "purchases", channel: "web", id: "family-pack", actor: `account:${account}`, email });
    await recordOperation({ metric: "generation", channel: "web", outcome: "success", actor: "trial:another-family", email, durationMs: 10000 });
    await recordOperation({ metric: "checkout", channel: "web", outcome: "created", actor: `account:${account}`, email });
    await recordUsage({ metric: "drawings", channel: "web", id: "family-without-email", actor: "trial:family" });
    expect(await redis(["KEYS", "doodle:metrics:day:*"])).toEqual([]);
    expect(await redis(["KEYS", "doodle:metrics:operations:*"])).toEqual([]);
    expect((await redis(["SMEMBERS", "doodle:metrics:qa"])).join(" ")).not.toContain(email);
  });
  it("uses the drawing's response day even if the background callback runs after midnight", async () => {
    vi.setSystemTime(new Date("2026-10-01T21:59:59Z"));
    trackUsage({ metric: "drawings", channel: "web", id: "before-midnight", actor: "trial:anonymous" });
    vi.setSystemTime(new Date("2026-10-01T22:00:01Z"));
    await flushCallbacks();
    expect(await redis(["HGET", "doodle:metrics:day:2026-10-01", "drawings:web"])).toBe("1");
    expect(await redis(["HGET", "doodle:metrics:day:2026-10-02", "drawings:web"])).toBe(null);
  });
  it("aggregates outcomes and timing atomically without retaining new operation or visitor references", async () => {
    const event = { metric: "generation", channel: "web", outcome: "success", durationMs: 25_123, actor: "trial:private", email: "buyer@example.com" } as const;
    await Promise.all(Array.from({ length: 8 }, () => recordOperation(event)));
    await recordOperation({ metric: "generation", channel: "android", outcome: "credits_exhausted" });
    const key = "doodle:metrics:operations:day:2026-10-02";
    expect(await redis(["HGETALL", key])).toEqual({
      collection_version: "1",
      "generation:web:success": "8",
      "generation:web:success:duration_count": "8",
      "generation:web:success:duration_ms": "200984",
      "generation:web:success:10_to_30s": "8",
      "generation:android:credits_exhausted": "1",
    });
    expect(await redis(["KEYS", "doodle:metrics:*"])).toEqual([key]);
    expect(await redis(["TTL", key])).toBeLessThanOrEqual(90 * 86_400);
    expect(await redis(["TTL", key])).toBeGreaterThan(89 * 86_400);
  });
  it("excludes operational activity for an already known anonymous QA identity", async () => {
    await recordUsage({ metric: "drawings", channel: "web", id: "qa", actor: "trial:qa", email: "samicodesit@gmail.com" });
    await recordOperation({ metric: "generation", channel: "web", outcome: "timeout", actor: "trial:qa", durationMs: 120_000 });
    await recordOperation({ metric: "checkout", channel: "web", outcome: "created", email: "doodlereview889@gmail.com" });
    expect(await redis(["KEYS", "doodle:metrics:operations:*"])).toEqual([]);
  });
  it("grants fifty complimentary credits exactly once under concurrent retries without recording a sale", async () => {
    const input = { grantId: "22222222-2222-4222-8222-222222222222", credits: 50, reason: "owner_gift" };
    const results = await Promise.all(Array.from({ length: 8 }, () => grantComplimentaryCredits(account, input)));
    expect(results.filter(result => result.granted)).toHaveLength(1);
    expect(await redis(["GET", `doodle:account:${account}:balance`])).toBe("50");
    expect(await redis(["HLEN", `doodle:account:${account}:grants`])).toBe(1);
    expect(await redis(["SISMEMBER", "doodle:metrics:gifted", createHash("sha256").update(`account:${account}`).digest("hex")])).toBe(1);
    expect(callbacks).toHaveLength(0);
    expect(await redis(["KEYS", "doodle:purchase:*"])).toEqual([]);
    expect(await redis(["KEYS", "doodle:metrics:day:*"])).toEqual([]);
  });
  it("adds the gift to an existing balance, preserves spent credits on replay, and rejects a changed grant", async () => {
    await redis(["SET", `doodle:account:${account}:balance`, "7"]);
    const input = { grantId: "22222222-2222-4222-8222-222222222222", credits: 50, reason: "owner_gift" };
    expect(await grantComplimentaryCredits(account, input)).toEqual({ granted: true, balance: 57 });
    await redis(["DECRBY", `doodle:account:${account}:balance`, "3"]);
    expect(await grantComplimentaryCredits(account, input)).toEqual({ granted: false, balance: 54 });
    await expect(grantComplimentaryCredits(account, { ...input, credits: 51 })).rejects.toThrow("Grant does not match its original record");
    expect(await redis(["GET", `doodle:account:${account}:balance`])).toBe("54");
  });
  it("rejects deleted, inactive and malformed accounts without changing balances", async () => {
    const input = { grantId: "22222222-2222-4222-8222-222222222222", credits: 50, reason: "owner_gift" };
    await expect(grantComplimentaryCredits("not-an-account", input)).rejects.toThrow();
    await expect(grantComplimentaryCredits(account, { ...input, credits: -1 })).rejects.toThrow();
    await redis(["SET", `doodle:account:${account}:deleted`, "deleted"]);
    await expect(grantComplimentaryCredits(account, input)).rejects.toThrow("Account is not active");
    await redis(["DEL", `doodle:account:${account}:deleted`, `doodle:account:${account}:active`]);
    await expect(grantComplimentaryCredits(account, input)).rejects.toThrow("Account is not active");
    expect(await redis(["GET", `doodle:account:${account}:balance`])).toBe(null);
    expect(await redis(["KEYS", "doodle:metrics:*"])).toEqual([]);
  });
  it("does not partially grant when bookkeeping keys have the wrong type", async () => {
    const input = { grantId: "22222222-2222-4222-8222-222222222222", credits: 50, reason: "owner_gift" };
    await redis(["SET", "doodle:metrics:gifted", "invalid-type"]);
    await expect(grantComplimentaryCredits(account, input)).rejects.toThrow("Grant storage unavailable");
    expect(await redis(["GET", `doodle:account:${account}:balance`])).toBe(null);
    expect(await redis(["EXISTS", `doodle:account:${account}:grants`])).toBe(0);
  });
  it("removes complimentary grant records and the gifted label when the account is deleted", async () => {
    const input = { grantId: "22222222-2222-4222-8222-222222222222", credits: 50, reason: "owner_gift" };
    await grantComplimentaryCredits(account, input);
    const identity = "a".repeat(64);
    await redis(["SET", `doodle:auth:google:${identity}`, account]);
    await deletePaidAccount(account, identity);
    expect(await redis(["EXISTS", `doodle:account:${account}:grants`])).toBe(0);
    expect(await redis(["SISMEMBER", "doodle:metrics:gifted", createHash("sha256").update(`account:${account}`).digest("hex")])).toBe(0);
    await expect(grantComplimentaryCredits(account, input)).rejects.toThrow("Account is not active");
  });
  it("separates gifted drawings while keeping a later real purchase counted", async () => {
    await redis(["SADD", "doodle:metrics:gifted", createHash("sha256").update(`account:${account}`).digest("hex")]);
    const event = { metric: "drawings", channel: "android", id: "gifted-drawing", actor: `account:${account}` } as const;
    await Promise.all(Array.from({ length: 5 }, () => recordUsage(event)));
    expect(await redis(["HGETALL", "doodle:metrics:day:2026-10-02"])).toEqual({ "gifted_drawings:android": "1" });
    await play();
    await flushCallbacks();
    expect(await redis(["HGET", "doodle:metrics:day:2026-10-02", "purchases:android"])).toBe("1");
  });
  it("keeps gifted failures, timing and checkout setup visible separately without private identifiers", async () => {
    const actor = `account:${account}`;
    await redis(["SADD", "doodle:metrics:gifted", createHash("sha256").update(actor).digest("hex")]);
    await recordOperation({ metric: "generation", channel: "android", outcome: "timeout", durationMs: 120_000, actor });
    await recordOperation({ metric: "checkout", channel: "web", outcome: "created", actor });
    expect(await redis(["HGETALL", "doodle:metrics:operations:day:2026-10-02"])).toEqual({
      collection_version: "1", "gifted:generation:android:timeout": "1",
      "gifted:generation:android:timeout:duration_count": "1",
      "gifted:generation:android:timeout:duration_ms": "120000",
      "gifted:generation:android:timeout:120s_plus": "1", "gifted:checkout:web:created": "1",
    });
    expect((await redis(["KEYS", "doodle:metrics:*"])).join(" ")).not.toContain(account);
    await redis(["SADD", "doodle:metrics:qa", createHash("sha256").update(actor).digest("hex")]);
    await recordUsage({ metric: "drawings", channel: "web", id: "qa-priority", actor });
    expect(await redis(["HGET", "doodle:metrics:day:2026-10-02", "gifted_drawings:web"])).toBe(null);
  });
  it("does not label retained earlier paid drawings as a first doodle", async () => {
    await redis(["HSET", "doodle:account:" + account + ":finalized", "earlier-drawing", 9, "current-drawing", 8]);
    await recordFunnel({ metric: "first_doodle", actor: "account:" + account }, new Date("2026-10-10T12:00:00Z"));
    const report = await readFunnel(["2026-10-10"]);
    expect(report.regular.first_doodle).toBeNull();
  });

  it("counts the first paid drawing for an identity with no earlier finalizations", async () => {
    await redis(["HSET", "doodle:account:" + account + ":finalized", "current-drawing", 9]);
    await recordFunnel({ metric: "first_doodle", actor: "account:" + account }, new Date("2026-10-10T12:00:00Z"));
    const report = await readFunnel(["2026-10-10"]);
    expect(report.regular.first_doodle).toBe(1);
  });

  it("retains the first paid drawing decision across concurrent draws and replay", async () => {
    await redis(["SET", "doodle:account:" + account + ":balance", 10]);
    const refs = ["11111111-1111-4111-8111-111111111112", "11111111-1111-4111-8111-111111111113"];
    await Promise.all(refs.map(ref => reservePaidCredit(account, ref)));
    const finalized = await Promise.all(refs.map(ref => finalizePaidCredit(account, ref)));
    const firstIndex = finalized.findIndex(value => "firstDoodle" in value && value.firstDoodle === true);
    expect(firstIndex).toBeGreaterThanOrEqual(0);
    expect(finalized.filter(value => "firstDoodle" in value && value.firstDoodle === true)).toHaveLength(1);
    const replay = await finalizePaidCredit(account, refs[firstIndex]);
    expect(replay).toEqual(finalized[firstIndex]);
    await recordFunnel({ metric: "first_doodle", actor: "account:" + account, knownFirstPaid: true }, new Date("2026-10-10T12:00:00Z"));
    expect((await readFunnel(["2026-10-10"])).regular.first_doodle).toBe(1);
  });

  it("keeps historical paid finalizations ineligible for a first-doodle event", async () => {
    await redis(["SET", "doodle:account:" + account + ":balance", 10]);
    await redis(["HSET", "doodle:account:" + account + ":finalized", "historical-drawing", 10]);
    const ref = "11111111-1111-4111-8111-111111111114";
    await reservePaidCredit(account, ref);
    const finalized = await finalizePaidCredit(account, ref);
    expect("firstDoodle" in finalized && finalized.firstDoodle === true).toBe(false);
  });

  it("does not manufacture a first doodle when a partially used legacy trial signs in", async () => {
    const trial = "11111111-1111-4111-8111-111111111115";
    await redis(["SET", "doodle:trial:used:" + trial, 2]);
    await mergeFunnelIdentity("trial:" + trial, "account:" + account);
    await recordFunnel({ metric: "first_doodle", actor: "account:" + account, knownFirstPaid: true }, new Date("2026-10-10T12:00:00Z"));
    expect((await readFunnel(["2026-10-10"])).regular.first_doodle).toBeNull();
  });

  it("keeps an observed first free drawing when sign-in precedes its delayed metric callback", async () => {
    const trial = "11111111-1111-4111-8111-111111111116";
    await redis(["SET", "doodle:trial:used:" + trial, 1]);
    await mergeFunnelIdentity("trial:" + trial, "account:" + account);
    await recordFunnel({ metric: "first_doodle", actor: "trial:" + trial, knownFirstFree: true }, new Date("2026-10-10T12:00:00Z"));
    await recordFunnel({ metric: "first_doodle", actor: "account:" + account, knownFirstPaid: true }, new Date("2026-10-10T12:00:00Z"));
    expect((await readFunnel(["2026-10-10"])).regular.first_doodle).toBe(1);
  });

  it("does not turn an existing paid account into a first doodle through a fresh trial alias", async () => {
    const trial = "11111111-1111-4111-8111-111111111117";
    await redis(["HSET", "doodle:account:" + account + ":finalized", "historical-reservation", 9]);
    await recordFunnel({ metric: "first_doodle", actor: "trial:" + trial, knownFirstFree: true }, new Date("2026-10-10T12:00:00Z"));
    await mergeFunnelIdentity("trial:" + trial, "account:" + account);
    expect((await readFunnel(["2026-10-10"])).regular.first_doodle).toBe(0);
  });

  it("bounds concurrent catalog reads per client and expires protected counters", async () => {
    vi.stubEnv("SESSION_SECRET", "isolated-catalog-secret-at-least-32-characters");
    const { checkWebCatalogLimit } = await import("./billing/web-packs");
    const request = new Request("https://doodle.example/api/checkout/catalog", {headers: {"x-vercel-forwarded-for": "192.0.2.40"}});
    const outcomes = await Promise.all(Array.from({length: 31}, () => checkWebCatalogLimit(request)));
    expect(outcomes.filter(status => status === "allowed")).toHaveLength(30);
    expect(outcomes.filter(status => status === "rate_limited")).toHaveLength(1);
    const keys = await redis(["KEYS", "doodle:stripe:catalog:*"]);
    expect(keys).toHaveLength(2);
    for (const key of keys) {
      expect(key).not.toContain("192.0.2.40");
      expect(await redis(["TTL", key])).toBeGreaterThan(0);
      expect(await redis(["TTL", key])).toBeLessThanOrEqual(120);
    }
    vi.setSystemTime(new Date(Date.now() + 60_000));
    expect(await checkWebCatalogLimit(request)).toBe("allowed");
  });
  it("shares the catalog cap across different clients", async () => {
    vi.stubEnv("SESSION_SECRET", "isolated-catalog-secret-at-least-32-characters");
    const { checkWebCatalogLimit } = await import("./billing/web-packs");
    const request = (ip: string) => new Request("https://doodle.example/api/checkout/catalog", {headers: {"x-vercel-forwarded-for": ip}});
    expect(await checkWebCatalogLimit(request("192.0.2.41"))).toBe("allowed");
    const [key] = await redis(["KEYS", "doodle:stripe:catalog:global:*"]);
    await redis(["SET", key, 599, "KEEPTTL"]);
    const outcomes = await Promise.all([checkWebCatalogLimit(request("192.0.2.42")), checkWebCatalogLimit(request("192.0.2.43"))]);
    expect(outcomes.sort()).toEqual(["allowed", "rate_limited"]);
  });

});
