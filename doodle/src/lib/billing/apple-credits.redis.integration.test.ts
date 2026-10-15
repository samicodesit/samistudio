import { createHash } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { isolatedRedis } from "../test-utils/isolated-redis";
import type { VerifiedApplePurchase } from "./apple-purchase";
import { claimAppleCredits, createAppleIntent, restoreAppleCredits, revokeAppleCredits } from "./apple-credits";
import { getAppleCreditScope } from "./apple-credit-scope";
import { finalizePaidCredit, getPaidBalance, reservePaidCredit } from "./credits";

vi.mock("server-only", () => ({}));
const redisCommand = vi.hoisted(() => vi.fn());
vi.mock("@/lib/redis", () => ({ redisCommand, redisInteger: (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw Error("Invalid Redis integer");
  return parsed;
} }));

const redis = isolatedRedis();
const accountA = "11111111-1111-4111-8111-111111111111";
const accountB = "22222222-2222-4222-8222-222222222222";
const balanceKey = (account: string) => `doodle:account:${account}:balance`;
const receiptKey = (transactionId: string, environment = "Production") =>
  `doodle:apple:${environment.toLowerCase()}:purchase:${createHash("sha256").update(transactionId).digest("hex")}`;
const purchase = (appAccountToken: string, fields: Partial<VerifiedApplePurchase> = {}): VerifiedApplePurchase => ({
  transactionId: "200000000000001", originalTransactionId: "200000000000001",
  bundleId: "nl.samistudio.doodle", productId: "pack_regular", type: "Consumable", quantity: 1,
  appAccountToken, inAppOwnershipType: "PURCHASED", environment: "Production",
  purchaseDate: Date.parse("2026-10-31T20:00:00Z"), ...fields,
});
const checkoutAt = new Date("2026-10-31T19:00:00Z");
async function activate(account: string) { await redis.command(["SET", `doodle:account:${account}:active`, "1"]); }

describe("Apple promised credit delivery against isolated Redis", () => {
  beforeAll(async () => { await redis.start(); redisCommand.mockImplementation(redis.command); });
  beforeEach(async () => { redisCommand.mockImplementation(redis.command); await redis.command(["FLUSHDB"]); vi.stubEnv("DOODLE_LAUNCH_DELAY_DAYS", "0"); await activate(accountA); });
  afterAll(async () => { vi.unstubAllEnvs(); await redis.stop(); });

  it.each([
    ["pack_mini", 6], ["pack_regular", 25], ["pack_big", 60],
  ] as const)("delivers the promised %s quantity once under concurrent retries", async (productId, credits) => {
    const intent = await createAppleIntent(accountA, productId, credits, "Production", checkoutAt);
    const transaction = purchase(intent.appAccountToken, { productId });
    const results = await Promise.all(Array.from({ length: 8 }, () => claimAppleCredits(accountA, transaction)));
    expect(results.filter(result => result.status === "granted")).toHaveLength(1);
    expect(results.every(result => result.balance === credits && result.creditsGranted === credits)).toBe(true);
    expect(await redis.command(["GET", balanceKey(accountA)])).toBe(String(credits));
  });

  it("honours a 25-credit checkout after the offer expires", async () => {
    const intent = await createAppleIntent(accountA, "pack_regular", 25, "Production", checkoutAt);
    expect(await claimAppleCredits(accountA, purchase(intent.appAccountToken, {
      purchaseDate: Date.parse("2026-11-02T12:00:00Z"),
    }))).toMatchObject({ status: "granted", balance: 25, offerApplied: true });
    await expect(createAppleIntent(accountA, "pack_regular", 25, "Production", new Date("2026-11-02T12:00:00Z"))).rejects.toThrow("offer_changed");
    const ordinary = await createAppleIntent(accountA, "pack_regular", 20, "Production", new Date("2026-11-02T12:00:00Z"));
    expect(await claimAppleCredits(accountA, purchase(ordinary.appAccountToken, { transactionId: "200000000000002" })))
      .toMatchObject({ status: "granted", balance: 45, creditsGranted: 20, offerApplied: false });
  });

  it("rejects foreign accounts and a reused checkout without changing balances", async () => {
    await activate(accountB);
    const intent = await createAppleIntent(accountA, "pack_regular", 25, "Production", checkoutAt);
    await expect(claimAppleCredits(accountB, purchase(intent.appAccountToken))).rejects.toThrow();
    await claimAppleCredits(accountA, purchase(intent.appAccountToken));
    await expect(claimAppleCredits(accountA, purchase(intent.appAccountToken, { transactionId: "200000000000002" }))).rejects.toThrow();
    expect(await redis.command(["GET", balanceKey(accountA)])).toBe("25");
    expect(await redis.command(["GET", balanceKey(accountB)])).toBeNull();
  });

  it.each([
    { productId: "pack_big" }, { environment: "Sandbox" }, { appAccountToken: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
    { revocationDate: Date.parse("2026-11-01T12:00:00Z") },
  ] as Partial<VerifiedApplePurchase>[])("rejects unmatched or revoked transaction %# before delivery", async fields => {
    const intent = await createAppleIntent(accountA, "pack_regular", 25, "Production", checkoutAt);
    await expect(claimAppleCredits(accountA, purchase(intent.appAccountToken, fields))).rejects.toThrow();
    expect(await redis.command(["GET", balanceKey(accountA)])).toBeNull();
    expect(await redis.command(["EXISTS", receiptKey("200000000000001")])).toBe(0);
  });

  it("refuses deleted accounts and leaves the transaction unfinished", async () => {
    const intent = await createAppleIntent(accountA, "pack_regular", 25, "Production", checkoutAt);
    await redis.command(["SET", `doodle:account:${accountA}:deleted`, "deleted"]);
    await expect(claimAppleCredits(accountA, purchase(intent.appAccountToken))).rejects.toThrow();
    expect(await redis.command(["GET", balanceKey(accountA)])).toBeNull();
  });

  it.each(["invalid", "1e2", "1.0", "01"])("does not consume a checkout or receipt when the credit balance is corrupt: %s", async balance => {
    const intent = await createAppleIntent(accountA, "pack_regular", 25, "Production", checkoutAt);
    await redis.command(["SET", balanceKey(accountA), balance]);
    await expect(claimAppleCredits(accountA, purchase(intent.appAccountToken))).rejects.toThrow();
    expect(await redis.command(["EXISTS", receiptKey("200000000000001")])).toBe(0);
    await redis.command(["SET", balanceKey(accountA), "0"]);
    expect(await claimAppleCredits(accountA, purchase(intent.appAccountToken))).toMatchObject({ status: "granted", balance: 25 });
  });

  it("isolates sandbox grants from real purchased credits", async () => {
    await redis.command(["SET", balanceKey(accountA), "87"]);
    const intent = await createAppleIntent(accountA, "pack_mini", 6, "Sandbox", checkoutAt);
    expect(await claimAppleCredits(accountA, purchase(intent.appAccountToken, { productId: "pack_mini", environment: "Sandbox" })))
      .toMatchObject({ status: "granted", balance: 6 });
    expect(await redis.command(["GET", balanceKey(accountA)])).toBe("87");
    expect(await redis.command(["GET", `doodle:account:${accountA}:purchased`])).toBeNull();
  });
  it("lets iOS spend its verified sandbox credits while web and Android keep the live balance", async () => {
    await redis.command(["SET", balanceKey(accountA), "87"]);
    const intent = await createAppleIntent(accountA, "pack_mini", 6, "Sandbox", checkoutAt);
    await claimAppleCredits(accountA, purchase(intent.appAccountToken, { productId: "pack_mini", environment: "Sandbox" }));
    const scope = await getAppleCreditScope(new Request("https://doodle.test", { headers: { "x-doodle-client": "native-ios" } }), accountA);
    expect(scope).toBe("apple-sandbox");
    expect(await reservePaidCredit(accountA, "sandbox-generation", scope)).toEqual({ reserved: true, remaining: 5 });
    expect(await finalizePaidCredit(accountA, "sandbox-generation", scope)).toMatchObject({ finalized: true, remaining: 5 });
    expect(await getPaidBalance(accountA, scope)).toBe(5);
    expect(await getPaidBalance(accountA)).toBe(87);
    expect(await getAppleCreditScope(new Request("https://doodle.test", { headers: { "x-doodle-client": "native-android" } }), accountA)).toBe("production");
    expect(await getAppleCreditScope(new Request("https://doodle.test"), accountA)).toBe("production");
  });
  it("uses the release checkout promise for Apple's sandbox review purchase", async () => {
    const intent = await createAppleIntent(accountA, "pack_mini", 6, "Production", checkoutAt, true);
    expect(await claimAppleCredits(accountA, purchase(intent.appAccountToken, { productId: "pack_mini", environment: "Sandbox" }))).toMatchObject({ balance: 6 });
    expect(await getPaidBalance(accountA)).toBe(0);
  });
  it("does not let recovery of an older sandbox purchase hide a newer production balance", async () => {
    const sandbox = await createAppleIntent(accountA, "pack_mini", 6, "Sandbox", checkoutAt);
    const oldTransaction = purchase(sandbox.appAccountToken, { productId: "pack_mini", environment: "Sandbox", purchaseDate: 1000 });
    await claimAppleCredits(accountA, oldTransaction);
    const production = await createAppleIntent(accountA, "pack_mini", 6, "Production", checkoutAt);
    await claimAppleCredits(accountA, purchase(production.appAccountToken, { productId: "pack_mini", transactionId: "200000000000002", purchaseDate: 2000 }));
    await claimAppleCredits(accountA, oldTransaction);
    expect(await getAppleCreditScope(new Request("https://doodle.test", { headers: { "x-doodle-client": "native-ios" } }), accountA)).toBe("production");
  });
  it("treats a refund reversal arriving before any delivery as having nothing to restore", async () => {
    const intent = await createAppleIntent(accountA, "pack_mini", 6, "Production", checkoutAt);
    const transaction = purchase(intent.appAccountToken, { productId: "pack_mini" });
    expect(await restoreAppleCredits(transaction, Date.parse("2026-11-02T12:00:00Z"))).toMatchObject({ restored: 0 });
    expect(await claimAppleCredits(accountA, transaction)).toMatchObject({ balance: 6 });
  });

  it("tombstones a refund received before delivery", async () => {
    const intent = await createAppleIntent(accountA, "pack_regular", 25, "Production", checkoutAt);
    const transaction = purchase(intent.appAccountToken);
    const revoked = { ...transaction, revocationDate: Date.parse("2026-11-01T12:00:00Z"), revocationReason: 1 };
    expect(await revokeAppleCredits(revoked)).toMatchObject({ status: "tombstoned", recovered: 0 });
    await expect(claimAppleCredits(accountA, transaction)).rejects.toThrow();
    expect(await redis.command(["GET", balanceKey(accountA)])).toBeNull();
  });

  it("refunds only available credits, preserving an active generation hold", async () => {
    const intent = await createAppleIntent(accountA, "pack_mini", 6, "Production", checkoutAt);
    const transaction = purchase(intent.appAccountToken, { productId: "pack_mini" });
    await claimAppleCredits(accountA, transaction);
    await redis.command(["SET", balanceKey(accountA), "3"]);
    await redis.command(["ZADD", `doodle:account:${accountA}:holds`, Date.now() + 60000, "active-generation"]);
    const revoked = { ...transaction, revocationDate: Date.parse("2026-11-01T12:00:00Z"), revocationReason: 1 };
    expect(await revokeAppleCredits(revoked)).toMatchObject({ status: "reversed", recovered: 2, unrecovered: 4 });
    expect(await redis.command(["GET", balanceKey(accountA)])).toBe("1");
    expect(await revokeAppleCredits(revoked)).toMatchObject({ status: "already_revoked", recovered: 2, unrecovered: 4 });
    expect(await redis.command(["GET", balanceKey(accountA)])).toBe("1");
  });

  it("applies increasing partial refunds cumulatively without double reversal", async () => {
    const intent = await createAppleIntent(accountA, "pack_big", 60, "Production", checkoutAt);
    const transaction = purchase(intent.appAccountToken, { productId: "pack_big" });
    await claimAppleCredits(accountA, transaction);
    const partial = { ...transaction, revocationDate: Date.parse("2026-11-01T12:00:00Z"), revocationReason: 1, revocationPercentage: 50000 };
    expect(await revokeAppleCredits(partial)).toMatchObject({ recovered: 30, unrecovered: 0 });
    expect(await redis.command(["GET", balanceKey(accountA)])).toBe("30");
    expect(await revokeAppleCredits(partial)).toMatchObject({ status: "already_revoked", recovered: 30 });
    expect(await revokeAppleCredits({ ...partial, revocationPercentage: 100000 })).toMatchObject({ recovered: 60, unrecovered: 0 });
    expect(await redis.command(["GET", balanceKey(accountA)])).toBe("0");
  });

  it("does not reverse a sandbox refund from the production balance", async () => {
    await redis.command(["SET", balanceKey(accountA), "87"]);
    const intent = await createAppleIntent(accountA, "pack_mini", 6, "Sandbox", checkoutAt);
    const transaction = purchase(intent.appAccountToken, { productId: "pack_mini", environment: "Sandbox" });
    await claimAppleCredits(accountA, transaction);
    expect(await revokeAppleCredits({ ...transaction, revocationDate: Date.parse("2026-11-01T12:00:00Z"), revocationReason: 1 }))
      .toMatchObject({ recovered: 6, unrecovered: 0 });
    expect(await redis.command(["GET", balanceKey(accountA)])).toBe("87");
  });
  it("returns recovered credits once when Apple reverses a refund and ignores the older refund", async () => {
    const intent = await createAppleIntent(accountA, "pack_mini", 6, "Production", checkoutAt);
    const transaction = purchase(intent.appAccountToken, { productId: "pack_mini" });
    await claimAppleCredits(accountA, transaction);
    await redis.command(["SET", balanceKey(accountA), "3"]);
    const refund = { ...transaction, revocationDate: Date.parse("2026-11-01T12:00:00Z") };
    await revokeAppleCredits(refund);
    expect(await restoreAppleCredits(transaction, Date.parse("2026-11-02T12:00:00Z"))).toMatchObject({ restored: 3 });
    expect(await restoreAppleCredits(transaction, Date.parse("2026-11-02T12:00:00Z"))).toMatchObject({ restored: 0 });
    await revokeAppleCredits(refund);
    expect(await redis.command(["GET", balanceKey(accountA)])).toBe("3");
    expect(await claimAppleCredits(accountA, transaction)).toMatchObject({ status: "already_granted", balance: 3 });
  });
  it("allows original delivery after a refund-before-grant is reversed", async () => {
    const intent = await createAppleIntent(accountA, "pack_mini", 6, "Production", checkoutAt);
    const transaction = purchase(intent.appAccountToken, { productId: "pack_mini" });
    await revokeAppleCredits({ ...transaction, revocationDate: Date.parse("2026-11-01T12:00:00Z") });
    expect(await restoreAppleCredits(transaction, Date.parse("2026-11-02T12:00:00Z"))).toMatchObject({ restored: 0 });
    expect(await claimAppleCredits(accountA, transaction)).toMatchObject({ status: "granted", balance: 6 });
  });
});
