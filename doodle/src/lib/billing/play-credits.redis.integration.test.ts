import { createHash } from "node:crypto";
import { execFile, spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { createServer } from "node:net";
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { claimPlayCredits, voidPlayPurchase } from "./play-credits";
import { processPlayPurchase, type ProductPurchaseV2 } from "./play-purchase";

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
