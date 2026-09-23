import { createHmac } from "node:crypto";
import { execFile, spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import { promisify } from "node:util";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createOrGetGoogleAccount } from "./accounts";
import { deletePaidAccount, isPaidAccountActive } from "@/lib/billing/credits";

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
  beforeAll(async () => {
    port = await freePort();
    dataDir = mkdtempSync(`${tmpdir()}/doodle-account-redis-`);
    redisProcess = spawn("redis-server", ["--bind", "127.0.0.1", "--port", String(port), "--dir", dataDir, "--appendonly", "no"], { stdio: "ignore" });
    await waitForRedis();
  });

  beforeEach(async () => {
    vi.stubEnv("SESSION_SECRET", sessionSecret);
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
