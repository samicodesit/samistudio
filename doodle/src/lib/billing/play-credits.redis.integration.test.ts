import { createHash } from "node:crypto";
import { execFile, spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { createServer } from "node:net";
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { createPlayIntent } from "./play-intents";
import { claimPlayCredits, getPlayGrant, voidPlayPurchase } from "./play-credits";
import { processPlayPurchase, type ProductPurchaseV2 } from "./play-purchase";
import { getPurchaseHistory } from "./credits";

vi.mock("server-only", () => ({}));
const redisCommand = vi.hoisted(() => vi.fn());
vi.mock("@/lib/redis", () => ({
  redisCommand,
  redisInteger: (value: unknown) => Number(value),
}));

const execFileAsync = promisify(execFile);
const hasRedisBinaries = spawnSync("redis-server", ["--version"], { stdio: "ignore" }).status === 0
  && spawnSync("redis-cli", ["--version"], { stdio: "ignore" }).status === 0;
const describeRedis = hasRedisBinaries ? describe : describe.skip;
const accountA = "11111111-1111-4111-8111-111111111111";
const accountB = "22222222-2222-4222-8222-222222222222";
const token = "redis-integration-token-123456";
const tokenKey = `doodle:play:purchase:${createHash("sha256").update(token).digest("hex")}`;
const purchase: ProductPurchaseV2 = {
  purchaseStateContext: { purchaseState: "PURCHASED" },
  obfuscatedExternalAccountId: "bound-account",
  productLineItem: [{
    productId: "doodle_credits_10",
    productOfferDetails: { quantity: 1, refundableQuantity: 1, consumptionState: "CONSUMPTION_STATE_YET_TO_BE_CONSUMED" },
  }],
};

let port = 0;
let dataDir = "";
let redisProcess: ChildProcess | undefined;

async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const selected = typeof address === "object" && address ? address.port : 0;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (!selected) throw new Error("Could not select Redis test port");
  return selected;
}

async function redis(command: unknown[]) {
  const args = ["-h", "127.0.0.1", "-p", String(port), "--json", ...command.map(String)];
  const result = await execFileAsync("redis-cli", args, { maxBuffer: 1_000_000 });
  return JSON.parse(result.stdout.trim()) as unknown;
}

async function waitForRedis() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      if (await redis(["PING"]) === "PONG") return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Isolated Redis did not start");
}

function accountKey(accountId: string, suffix: string) {
  return `doodle:account:${accountId}:${suffix}`;
}

async function activate(accountId: string) {
  await redis(["SET", accountKey(accountId, "active"), "1"]);
}

describeRedis("Play credit ledger against isolated Redis", () => {
  it("does not consume an intent or write a receipt when the balance is corrupt", async () => {
    await activate(accountA);
    const reference = "c".repeat(64);
    await redis(["HSET", "doodle:play:intent:" + reference, "account", accountA, "productId", "pack_regular", "credits", 25, "offerApplied", "1"]);
    await redis(["SET", accountKey(accountA, "balance"), "invalid"]);
    await expect(claimPlayCredits(accountA, token, { productId: "pack_regular", credits: 25, offerApplied: true, intentRef: reference })).rejects.toThrow();
    expect(await redis(["EXISTS", tokenKey])).toBe(0);
    expect(await redis(["HGET", "doodle:play:intent:" + reference, "purchaseHash"])).toBeNull();
  });
  it("remembers a buyer after all credits are spent, without labelling gifts as purchases", async () => {
    await activate(accountA);
    expect(await getPurchaseHistory(accountA)).toBe(false);
    await redis(["SET", accountKey(accountA, "balance"), "0"]);
    expect(await getPurchaseHistory(accountA)).toBe(true);
    await redis(["SET", accountKey(accountA, "grants"), "gift"]);
    expect(await getPurchaseHistory(accountA)).toBeNull();
    await claimPlayCredits(accountA, token);
    await redis(["SET", accountKey(accountA, "balance"), "0"]);
    expect(await getPurchaseHistory(accountA)).toBe(true);
  });
  it("grants a 25-credit intent once and refuses a second purchase using the same intent", async () => {
    await activate(accountA);
    const reference="a".repeat(64);
    await redis(["HSET","doodle:play:intent:"+reference,"account",accountA,"productId","pack_regular","credits",25,"offerApplied","1"]);
    const grant={productId:"pack_regular",credits:25,offerApplied:true,intentRef:reference};
    const results=await Promise.all(Array.from({length:8},()=>claimPlayCredits(accountA,token,grant)));
    expect(results.filter(r=>r.granted)).toHaveLength(1);
    expect(await getPlayGrant(accountA,token)).toEqual({productId:"pack_regular",credits:25,offerApplied:true});
    await expect(claimPlayCredits(accountA,token+"-second",grant)).rejects.toThrow();
    expect(await redis(["GET",accountKey(accountA,"balance")])).toBe("25");
    const metadata={voidedAt:"2026-10-10T12:00:00.000Z",voidedReason:1,voidedSource:0,voidedQuantity:1} as const;
    expect(await voidPlayPurchase(token,metadata)).toMatchObject({recovered:25,unrecovered:0});
  });
  it.each([6,20,60])("refunds the stored %i-credit grant", async credits => {
    await activate(accountA);
    const reference="b".repeat(64);
    const productId=credits===6?"pack_mini":credits===60?"pack_big":"pack_regular";
    await redis(["HSET","doodle:play:intent:"+reference,"account",accountA,"productId",productId,"credits",credits,"offerApplied","0"]);
    await claimPlayCredits(accountA,token,{productId,credits,offerApplied:false,intentRef:reference});
    expect(await voidPlayPurchase(token,{voidedAt:"2026-10-10T12:00:00.000Z",voidedReason:1,voidedSource:0,voidedQuantity:1})).toMatchObject({recovered:credits,unrecovered:0});
  });
  it("preserves a pre-expiry bonus when verified after the deadline",async()=>{
    vi.stubEnv("PLAY_PACKS_CHECKOUT_ENABLED","true");
    await activate(accountA);
    const intent=await createPlayIntent(accountA,"pack_regular",25,new Date("2026-10-31T20:00:00Z"));
    const verified={...purchase,obfuscatedExternalProfileId:intent.obfuscatedProfileId,productLineItem:[{productId:"pack_regular",productOfferDetails:purchase.productLineItem![0].productOfferDetails}]};
    const publisher={getProductPurchase:async()=>verified,consumeProductPurchase:vi.fn().mockResolvedValue(undefined)};
    const input={accountId:accountA,expectedObfuscatedAccountId:"bound-account",purchaseToken:token,productId:"pack_regular",publisher};
    const first=await processPlayPurchase(input);
    expect(first).toMatchObject({status:"granted",balance:25,creditsGranted:25,offerApplied:true});
    expect(await processPlayPurchase(input)).toMatchObject({status:"already_granted",balance:25,creditsGranted:25});
    await expect(createPlayIntent(accountA,"pack_regular",25,new Date("2026-11-01T00:00:00Z"))).rejects.toThrow("offer_changed");
    expect(await createPlayIntent(accountA,"pack_regular",20,new Date("2026-11-01T00:00:00Z"))).toMatchObject({credits:20,offerApplied:false});
    vi.unstubAllEnvs();
  });
  it("rejects missing, foreign and mismatched new-pack intents without credit delivery",async()=>{
    await activate(accountA);
    const verified={...purchase,productLineItem:[{productId:"pack_regular",productOfferDetails:purchase.productLineItem![0].productOfferDetails}]};
    await expect(processPlayPurchase({accountId:accountA,expectedObfuscatedAccountId:"bound-account",purchaseToken:token,productId:"pack_regular",publisher:{getProductPurchase:async()=>verified,consumeProductPurchase:async()=>{}}})).rejects.toMatchObject({kind:"invalid"});
    const reference="c".repeat(64);
    await redis(["HSET","doodle:play:intent:"+reference,"account",accountB,"productId","pack_regular","credits",25,"offerApplied","1"]);
    await expect(claimPlayCredits(accountA,token,{productId:"pack_regular",credits:25,offerApplied:true,intentRef:reference})).rejects.toThrow();
    expect(await redis(["GET",accountKey(accountA,"balance")])).toBeNull();
  });
  beforeAll(async () => {
    port = await freePort();
    dataDir = mkdtempSync(`${tmpdir()}/doodle-play-redis-`);
    redisProcess = spawn("redis-server", ["--bind", "127.0.0.1", "--port", String(port), "--dir", dataDir, "--appendonly", "no"], { stdio: "ignore" });
    await waitForRedis();
  });

  beforeEach(async () => {
    await redis(["FLUSHDB"]);
    redisCommand.mockImplementation(redis);
  });

  afterAll(async () => {
    if (redisProcess && redisProcess.exitCode === null) {
      redisProcess.kill("SIGTERM");
      await new Promise<void>((resolve) => redisProcess?.once("exit", () => resolve()));
    }
    if (dataDir) rmSync(dataDir, { recursive: true, force: true });
  });

  it("grants a same-token race exactly once", async () => {
    await activate(accountA);

    const results = await Promise.all(Array.from({ length: 8 }, () => claimPlayCredits(accountA, token)));

    expect(results.filter((result) => result.granted)).toHaveLength(1);
    expect(results.every((result) => result.balance === 10)).toBe(true);
    expect(await redis(["GET", accountKey(accountA, "balance")])).toBe("10");
    expect(await redis(["HGET", tokenKey, "account"])).toBe(accountA);
  });

  it("rejects a token owned by another account without changing its balance", async () => {
    await activate(accountA);
    await activate(accountB);
    await claimPlayCredits(accountA, token);

    await expect(claimPlayCredits(accountB, token)).rejects.toThrow("Purchase belongs to another account");
    expect(await redis(["GET", accountKey(accountB, "balance")])).toBe(null);
  });

  it("retries consumption without granting a second pack", async () => {
    await activate(accountA);
    const publisher = {
      getProductPurchase: vi.fn().mockResolvedValue(purchase),
      consumeProductPurchase: vi.fn()
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValueOnce(undefined),
    };
    const input = { accountId: accountA, expectedObfuscatedAccountId: "bound-account", purchaseToken: token, productId: "doodle_credits_10", publisher };

    await expect(processPlayPurchase(input)).resolves.toEqual({ status: "granted_consume_pending", balance: 10 });
    await expect(processPlayPurchase(input)).resolves.toEqual({ status: "already_granted", balance: 10 });

    expect(await redis(["GET", accountKey(accountA, "balance")])).toBe("10");
    expect(await redis(["HGET", tokenKey, "state"])).toBe("consumed");
    expect(publisher.consumeProductPurchase).toHaveBeenCalledTimes(2);
  });

  it("makes duplicate voids idempotent without taking the balance below zero", async () => {
    await activate(accountA);
    await claimPlayCredits(accountA, token);
    const metadata = { voidedAt: "2026-09-08T09:30:00.000Z", voidedReason: 7, voidedSource: 2, voidedQuantity: 1 } as const;

    await expect(voidPlayPurchase(token, metadata)).resolves.toEqual({ status: "reversed", recovered: 10, unrecovered: 0, priorState: "granted" });
    await expect(voidPlayPurchase(token, metadata)).resolves.toEqual({ status: "already_voided", recovered: 10, unrecovered: 0, priorState: "granted" });

    expect(await redis(["GET", accountKey(accountA, "balance")])).toBe("0");
  });
});
