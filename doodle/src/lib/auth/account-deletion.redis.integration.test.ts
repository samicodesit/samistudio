import { createHash, createHmac } from "node:crypto";
import { execFile, spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import { promisify } from "node:util";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createOrGetGoogleAccount, createOrGetAppleAccount } from "./accounts";
import { createNativeSession, getNativeSessionUser } from "@/lib/native-session";
import { deletePaidAccount, isPaidAccountActive } from "@/lib/billing/credits";
import { migrateNativeSessionIndex } from "./native-session-migration";
import { processAppleNotification } from "./apple-notifications";
import { storeAppleAuthorization } from "./apple-tokens";

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
const googleSubject = "google-deletion-race";
const sessionSecret = "account-deletion-integration-secret";
const identityKey = createHmac("sha256", sessionSecret).update(googleSubject).digest("hex");
const mappingKey = `doodle:auth:google:${identityKey}`;

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

describeRedis("account deletion against isolated Redis", () => {
  it("removes Apple sandbox credit state and the trusted environment when deleting the account", async () => {
    const account = await createOrGetGoogleAccount("sandbox-cleanup");
    const keys = ["balance", "holds", "finalized", "purchased"].map(suffix => `doodle:apple:sandbox:account:${account.id}:${suffix}`);
    keys.push(accountKey(account.id, "apple-billing-environment"));
    for (const key of keys) await redis(["SET", key, "test-record"]);
    await deletePaidAccount(account.id, account.identityKey);
    for (const key of keys) expect(await redis(["EXISTS", key])).toBe(0);
  });
  it("removes indexed Apple attestation keys and receipts with the account", async () => {
    const account = await createOrGetGoogleAccount("attestation-cleanup");
    const keys = ["production", "development"].map(environment => `doodle:apple:attest:${environment}:key:${"a".repeat(64)}`);
    for (const key of keys) await redis(["HSET", key, "record", "public-key-and-receipt", "counter", "2"]);
    await redis(["SADD", accountKey(account.id, "apple-attest-keys"), ...keys]);
    await deletePaidAccount(account.id, account.identityKey);
    for (const key of keys) expect(await redis(["EXISTS", key])).toBe(0);
    expect(await redis(["EXISTS", accountKey(account.id, "apple-attest-keys")])).toBe(0);
  });

  it("signs out revoked Apple sessions without losing credits and requires fresh authorization", async () => {
    const account = await createOrGetAppleAccount("notification-revoked");
    const user = { ...account, provider: "apple" as const, email: null, appleAuthenticatedAt: 100 };
    await redis(["SET", accountKey(account.id, "balance"), "25"]);
    await storeAppleAuthorization(account, "test-refresh-token", 100);
    const session = await createNativeSession(user);
    const notification = { id: "revoked-1", type: "consent-revoked" as const, subject: "notification-revoked", eventTime: 101 };
    await processAppleNotification(notification);
    await expect(getNativeSessionUser(session.accessToken)).resolves.toBeNull();
    await expect(createNativeSession(user)).rejects.toThrow();
    await expect(storeAppleAuthorization(account, "old-refresh-token", 100)).rejects.toThrow();
    expect(await redis(["GET", accountKey(account.id, "balance")])).toBe("25");
    expect(await redis(["GET", accountKey(account.id, "apple-authorization")])).toBeNull();
    expect(Number(await redis(["TTL", accountKey(account.id, "apple-revoked-authorization")]))).toBeGreaterThan(0);
    expect(Number(await redis(["TTL", accountKey(account.id, "apple-revoked-authorization")]))).toBeLessThanOrEqual(600);
    expect(await createOrGetAppleAccount("notification-revoked")).toEqual(account);
    await storeAppleAuthorization(account, "new-refresh-token", 102);
    expect(await redis(["GET", accountKey(account.id, "apple-revoked-authorization")])).toBeNull();
    const fresh = await createNativeSession({ ...user, appleAuthenticatedAt: 102 });
    await processAppleNotification(notification);
    await expect(getNativeSessionUser(fresh.accessToken)).resolves.toMatchObject({ id: account.id });
    expect(await redis(["GET", accountKey(account.id, "balance")])).toBe("25");
  });

  it("preserves a newer login on delayed revocation while rejecting unindexed old sessions", async () => {
    const account = await createOrGetAppleAccount("notification-delayed");
    const user = { ...account, provider: "apple" as const, email: null, appleAuthenticatedAt: 102 };
    await storeAppleAuthorization(account, "new-refresh-token", 102);
    const fresh = await createNativeSession(user);
    const oldToken = "o".repeat(43);
    const oldKey = "doodle:auth:native:" + createHash("sha256").update(oldToken).digest("hex");
    await redis(["SET", oldKey, JSON.stringify({ ...user, appleAuthenticatedAt: 100 }), "EX", 600]);
    await processAppleNotification({ id: "delayed-1", type: "consent-revoked", subject: "notification-delayed", eventTime: 101 });
    await expect(getNativeSessionUser(fresh.accessToken)).resolves.toEqual(user);
    await expect(getNativeSessionUser(oldToken)).resolves.toBeNull();
    expect(await redis(["GET", oldKey])).toBeNull();
    expect(await redis(["GET", accountKey(account.id, "apple-authorization")])).not.toBeNull();
    // A second login token issued before the latest revocation must not overwrite it.
    await expect(storeAppleAuthorization(account, "stale-token", 100)).rejects.toThrow();
  });

  it("permanently deletes only the Apple account and prevents deleted credentials recreating it", async () => {
    const apple = await createOrGetAppleAccount("notification-delete");
    const google = await createOrGetGoogleAccount("notification-delete");
    await redis(["SET", accountKey(apple.id, "balance"), "25"]);
    await redis(["SET", accountKey(google.id, "balance"), "60"]);
    await storeAppleAuthorization(apple, "test-refresh-token", 100);
    const session = await createNativeSession({ ...apple, provider: "apple", email: null, appleAuthenticatedAt: 100 });
    const notification = { id: "delete-1", type: "account-deleted" as const, subject: "notification-delete", eventTime: 101 };
    await processAppleNotification(notification);
    await processAppleNotification(notification);
    await expect(getNativeSessionUser(session.accessToken)).resolves.toBeNull();
    await expect(createOrGetAppleAccount("notification-delete")).rejects.toThrow();
    await expect(storeAppleAuthorization(apple, "stale-token", 102)).rejects.toThrow();
    expect(await redis(["GET", accountKey(apple.id, "balance")])).toBeNull();
    expect(await redis(["GET", accountKey(apple.id, "apple-authorization")])).toBeNull();
    expect(await redis(["GET", accountKey(google.id, "balance")])).toBe("60");
  });

  it("blocks deleted identities even if notification arrives before first login", async () => {
    await processAppleNotification({ id: "delete-before-login", type: "account-deleted", subject: "never-created", eventTime: 101 });
    await expect(createOrGetAppleAccount("never-created")).rejects.toThrow();
    expect(await redis(["KEYS", "doodle:account:*"])).toEqual([]);
  });

  it("keeps permanent deletion blocked and unacknowledged until failed cleanup is retried", async () => {
    const account = await createOrGetAppleAccount("notification-cleanup-retry");
    const session = await createNativeSession({ ...account, provider: "apple", email: null, appleAuthenticatedAt: 100 });
    await redis(["SET", accountKey(account.id, "balance"), "25"]);
    const notification = { id: "delete-retry", type: "account-deleted" as const, subject: "notification-cleanup-retry", eventTime: 101 };
    redisCommand.mockImplementation(async (command: unknown[]) => {
      if (command[0] === "EVAL" && command[3] === `doodle:auth:apple:${account.identityKey}`) throw new Error("Temporary deletion storage outage");
      return redis(command);
    });
    await expect(processAppleNotification(notification)).rejects.toThrow();
    await expect(getNativeSessionUser(session.accessToken)).resolves.toBeNull();
    await expect(createOrGetAppleAccount(notification.subject)).rejects.toThrow();
    expect(await redis(["GET", accountKey(account.id, "balance")])).toBe("25");
    expect(await redis(["KEYS", "doodle:auth:apple:notification:*"])).toEqual([]);
    redisCommand.mockImplementation(redis);
    await processAppleNotification(notification);
    expect(await redis(["GET", accountKey(account.id, "balance")])).toBeNull();
    expect((await redis(["KEYS", "doodle:auth:apple:notification:*"]) as string[]).length).toBe(1);
  });

  it("does not change sessions or balances for email forwarding notifications", async () => {
    const account = await createOrGetAppleAccount("notification-email");
    const user = { ...account, provider: "apple" as const, email: null, appleAuthenticatedAt: 100 };
    const session = await createNativeSession(user);
    await redis(["SET", accountKey(account.id, "balance"), "6"]);
    for (const type of ["email-disabled", "email-enabled"] as const) {
      await processAppleNotification({ id: type, type, subject: "notification-email", eventTime: 101 });
      await expect(getNativeSessionUser(session.accessToken)).resolves.toEqual(user);
    }
    expect(await redis(["GET", accountKey(account.id, "balance")])).toBe("6");
  });
  it("requires revocation of the latest Apple authorization when sign-in races with deletion", async () => {
    const account = await createOrGetAppleAccount("apple-authorization-race");
    await redis(["SET", accountKey(account.id, "balance"), "25"]);
    await redis(["SET", accountKey(account.id, "apple-authorization"), "new-authorization"]);
    await expect(deletePaidAccount(account.id, account.identityKey, "apple", "previous-authorization")).rejects.toThrow();
    expect(await redis(["GET", accountKey(account.id, "balance")])).toBe("25");
    expect(await redis(["GET", accountKey(account.id, "apple-authorization")])).toBe("new-authorization");
    await expect(isPaidAccountActive(account.id)).resolves.toBe(true);
    await deletePaidAccount(account.id, account.identityKey, "apple", "new-authorization");
    await expect(isPaidAccountActive(account.id)).resolves.toBe(false);
  });

  it("completes account deletion when Apple's consent notification arrives just after token revocation", async () => {
    const account = await createOrGetAppleAccount("in-app-delete-notification-race");
    await storeAppleAuthorization(account, "test-refresh-token", 100);
    const revokedSnapshot = await redis(["GET", accountKey(account.id, "apple-authorization")]) as string;
    await redis(["SET", accountKey(account.id, "balance"), "25"]);
    // Apple accepted revoke, then delivered the notification before the final local deletion.
    await processAppleNotification({ id: "after-in-app-revoke", type: "consent-revoked", subject: "in-app-delete-notification-race", eventTime: 101 });
    await expect(deletePaidAccount(account.id, account.identityKey, "apple", revokedSnapshot)).resolves.toBeUndefined();
    await expect(isPaidAccountActive(account.id)).resolves.toBe(false);
    expect(await redis(["GET", accountKey(account.id, "balance")])).toBeNull();
  });

  it("requires fresh revocation if a login replaces authorization after that consent notification", async () => {
    const account = await createOrGetAppleAccount("in-app-delete-new-login-race");
    await storeAppleAuthorization(account, "test-refresh-token", 100);
    const oldSnapshot = await redis(["GET", accountKey(account.id, "apple-authorization")]) as string;
    await processAppleNotification({ id: "after-revoke-before-login", type: "consent-revoked", subject: "in-app-delete-new-login-race", eventTime: 101 });
    await storeAppleAuthorization(account, "new-refresh-token", 102);
    await redis(["SET", accountKey(account.id, "balance"), "25"]);
    await expect(deletePaidAccount(account.id, account.identityKey, "apple", oldSnapshot)).rejects.toThrow();
    await expect(isPaidAccountActive(account.id)).resolves.toBe(true);
    expect(await redis(["GET", accountKey(account.id, "balance")])).toBe("25");
  });

  it("migrates dormant sessions only when applied, then deletes every account session", async () => {
    const account = await createOrGetGoogleAccount("dormant-session-migration");
    const user = { ...account, email: "dormant@example.com" };
    const keys = ["x", "y"].map(character => "doodle:auth:native:" + createHash("sha256").update(character.repeat(43)).digest("hex"));
    for (const key of keys) await redis(["SET", key, JSON.stringify(user), "EX", 600]);
    await expect(migrateNativeSessionIndex()).resolves.toEqual({ scanned: 2, indexed: 0, rejected: 0, applied: false });
    expect(await redis(["SMEMBERS", accountKey(account.id, "native-sessions")])).toEqual([]);
    await expect(migrateNativeSessionIndex(true)).resolves.toEqual({ scanned: 2, indexed: 2, rejected: 0, applied: true });
    await deletePaidAccount(account.id, account.identityKey);
    for (const key of keys) expect(await redis(["GET", key])).toBeNull();
  });

  it("indexes a legacy Google session without extending its lifetime and removes it on deletion", async () => {
    const account = await createOrGetGoogleAccount("legacy-google-session");
    const user = { ...account, email: "legacy@example.com" };
    const token = "l".repeat(43);
    const key = "doodle:auth:native:" + createHash("sha256").update(token).digest("hex");
    await redis(["SET", key, JSON.stringify(user), "EX", 600]);
    await expect(getNativeSessionUser(token)).resolves.toEqual(user);
    expect(await redis(["SMEMBERS", accountKey(account.id, "native-sessions")])).toEqual([key]);
    const ttl = Number(await redis(["TTL", key]));
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(600);
    await deletePaidAccount(account.id, account.identityKey);
    expect(await redis(["GET", key])).toBeNull();
  });

  it("rejects and erases an unindexed session for a deleted account", async () => {
    const account = await createOrGetGoogleAccount("deleted-legacy-session");
    await deletePaidAccount(account.id, account.identityKey);
    const token = "d".repeat(43);
    const key = "doodle:auth:native:" + createHash("sha256").update(token).digest("hex");
    await redis(["SET", key, JSON.stringify({ ...account, email: "deleted@example.com" }), "EX", 600]);
    await expect(getNativeSessionUser(token)).resolves.toBeNull();
    expect(await redis(["GET", key])).toBeNull();
    expect(await redis(["EXISTS", accountKey(account.id, "native-sessions")])).toBe(0);
  });

  it("keeps equal Apple and Google subjects in separate accounts and preserves Google credits", async () => {
    const google = await createOrGetGoogleAccount("same-provider-subject");
    await redis(["SET", accountKey(google.id, "balance"), "7"]);
    const apple = await createOrGetAppleAccount("same-provider-subject");
    expect(apple.id).not.toBe(google.id);
    expect(apple.identityKey).not.toBe(google.identityKey);
    expect(await createOrGetAppleAccount("same-provider-subject")).toEqual(apple);
    await redis(["SET", accountKey(apple.id, "balance"), "25"]);
    await redis(["SET", accountKey(apple.id, "apple-authorization"), "encrypted-test-authorization"]);
    const user = { ...apple, provider: "apple" as const, email: null, appleAuthenticatedAt: 100 };
    const first = await createNativeSession(user);
    const second = await createNativeSession(user);
    await expect(getNativeSessionUser(first.accessToken)).resolves.toEqual(user);
    await deletePaidAccount(apple.id, apple.identityKey, "apple");
    await expect(getNativeSessionUser(first.accessToken)).resolves.toBeNull();
    await expect(getNativeSessionUser(second.accessToken)).resolves.toBeNull();
    expect(await redis(["GET", accountKey(apple.id, "apple-authorization")])).toBeNull();
    expect(await redis(["GET", accountKey(apple.id, "balance")])).toBeNull();
    expect(await redis(["GET", accountKey(google.id, "balance")])).toBe("7");
    expect(await createOrGetGoogleAccount("same-provider-subject")).toEqual(google);
    const recreated = await createOrGetAppleAccount("same-provider-subject");
    expect(recreated.id).not.toBe(apple.id);
    expect(await redis(["GET", accountKey(recreated.id, "balance")])).toBeNull();
  });

  it("never leaves a native session usable or stored when session creation races with deletion", async () => {
    const account = await createOrGetAppleAccount("apple-session-race");
    const user = { ...account, provider: "apple" as const, email: null, appleAuthenticatedAt: 100 };
    const results = await Promise.allSettled([
      createNativeSession(user),
      deletePaidAccount(account.id, account.identityKey, "apple"),
    ]);
    const session = results[0];
    if (session.status === "fulfilled") await expect(getNativeSessionUser(session.value.accessToken)).resolves.toBeNull();
    await expect(createNativeSession(user)).rejects.toThrow();
    expect(await redis(["KEYS", "doodle:auth:native:*"])).toEqual([]);
  });

  beforeAll(async () => {
    port = await freePort();
    dataDir = mkdtempSync(`${tmpdir()}/doodle-account-redis-`);
    redisProcess = spawn("redis-server", ["--bind", "127.0.0.1", "--port", String(port), "--dir", dataDir, "--appendonly", "no"], { stdio: "ignore" });
    await waitForRedis();
  });

  beforeEach(async () => {
    vi.stubEnv("SESSION_SECRET", sessionSecret);
    vi.stubEnv("APPLE_AUTHORIZATION_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64url"));
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

  it("rotates a tombstoned Google mapping without carrying the old ledger", async () => {
    await redis(["SET", mappingKey, accountA]);
    await redis(["SET", accountKey(accountA, "active"), "1"]);
    await redis(["SET", accountKey(accountA, "balance"), "7"]);

    await deletePaidAccount(accountA, identityKey);

    await expect(isPaidAccountActive(accountA)).resolves.toBe(false);
    const recreated = await createOrGetGoogleAccount(googleSubject);

    expect(recreated.id).not.toBe(accountA);
    expect(await redis(["GET", mappingKey])).toBe(recreated.id);
    expect(await redis(["GET", accountKey(accountA, "balance")])).toBeNull();
    expect(await redis(["GET", accountKey(recreated.id, "balance")])).toBeNull();

    await redis(["SET", accountKey(accountA, "active"), "1"]);
    await expect(isPaidAccountActive(accountA)).resolves.toBe(false);
  });

  it("tombstones the old account when deletion races with a rotated mapping", async () => {
    await redis(["SET", mappingKey, accountB]);
    await redis(["SET", accountKey(accountA, "active"), "1"]);
    await redis(["SET", accountKey(accountA, "balance"), "7"]);

    await deletePaidAccount(accountA, identityKey);

    expect(await redis(["GET", mappingKey])).toBe(accountB);
    expect(await redis(["GET", accountKey(accountA, "balance")])).toBeNull();
    await expect(isPaidAccountActive(accountA)).resolves.toBe(false);
  });
});
