import { randomUUID } from "node:crypto";
import { execFile, spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { createServer } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ingestClientDiagnostics, recordServerDiagnostic } from "./store";
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: vi.fn() }));
const redisCommand = vi.hoisted(() => vi.fn());
vi.mock("@/lib/redis", () => ({ redisCommand }));
const exec = promisify(execFile);
const available = ["redis-server", "redis-cli"].every(binary => spawnSync(binary, ["--version"], { stdio: "ignore" }).status === 0);
let port = 0, directory = "";
let process: ChildProcess;
async function redis(command: unknown[]) {
  const result = await exec("redis-cli", ["-h", "127.0.0.1", "-p", String(port), "--json", ...command.map(String)], { maxBuffer: 2_000_000 });
  return JSON.parse(result.stdout.trim());
}
const day = new Date("2026-10-02T08:00:00Z");
const list = "doodle:diagnostics:client:day:2026-10-02";
function event() {
  return { v: 1 as const, id: randomUUID(), timestamp: day.toISOString(), appVersion: "1.0.0", build: "7", androidApi: 35, operation: "generation" as const, stage: "http_request" as const, code: "network" as const };
}
(available ? describe : describe.skip)("diagnostics against isolated Redis", () => {
  beforeAll(async () => {
    const socket = createServer();
    await new Promise<void>(resolve => socket.listen(0, "127.0.0.1", resolve));
    const address = socket.address();
    if (!address || typeof address === "string") throw new Error("Missing test port");
    port = address.port;
    await new Promise<void>(resolve => socket.close(() => resolve()));
    directory = mkdtempSync(tmpdir() + "/doodle-diagnostics-redis-");
    process = spawn("redis-server", ["--bind", "127.0.0.1", "--port", String(port), "--dir", directory, "--appendonly", "no", "--save", ""], { stdio: "ignore" });
    for (let i = 0; i < 50; i++) {
      try { if (await redis(["PING"]) === "PONG") return; } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error("Isolated Redis unavailable");
  });
  beforeEach(async () => {
    await redis(["FLUSHDB"]); redisCommand.mockImplementation(redis);
    vi.stubEnv("SESSION_SECRET", "integration-secret");
  });
  afterAll(async () => {
    vi.unstubAllEnvs();
    if (process && process.exitCode === null) {
      process.kill("SIGTERM"); await new Promise<void>(resolve => process.once("exit", () => resolve()));
    }
    if (directory) rmSync(directory, { recursive: true, force: true });
  });
  it("deduplicates concurrent retry batches and expires retained records and quota keys", async () => {
    const failure = event();
    const results = await Promise.all(Array.from({ length: 8 }, () => ingestClientDiagnostics([failure, failure], "192.0.2.1", day)));
    expect(results.every(result => result === "stored")).toBe(true);
    expect(await redis(["LLEN", list])).toBe(1);
    const ttl = await redis(["TTL", list]); expect(ttl).toBeGreaterThan(2591900); expect(ttl).toBeLessThanOrEqual(2592000);
    const quotas: string[] = await redis(["KEYS", "doodle:diagnostics:quota:*"]);
    expect(quotas).toHaveLength(1);
    expect(await redis(["GET", quotas[0]])).toBe("8");
    expect(await redis(["TTL", quotas[0]])).toBeLessThanOrEqual(3600);
    const rows: string[] = await redis(["LRANGE", list, 0, -1]);
    expect(JSON.parse(rows[0])).toEqual({ source: "client", receivedAt: day.toISOString(), event: failure });
  });
  it("enforces the client quota atomically and permits later hourly retries", async () => {
    const outcomes = await Promise.all(Array.from({ length: 65 }, () => ingestClientDiagnostics([event()], "192.0.2.2", day)));
    expect(outcomes.filter(result => result === "stored")).toHaveLength(60);
    expect(outcomes.filter(result => result === "rate_limited")).toHaveLength(5);
    expect(await redis(["LLEN", list])).toBe(60);
    expect(await ingestClientDiagnostics([event()], "192.0.2.2", new Date("2026-10-02T09:00:00Z"))).toBe("stored");
  });
  it("cannot exceed the daily event cap under concurrent uploads", async () => {
    await redis(["RPUSH", list, ...Array.from({ length: 999 }, () => "{}")]);
    const results = await Promise.all(Array.from({ length: 5 }, (_, i) => ingestClientDiagnostics([event()], "192.0.2." + i, day)));
    expect(results.filter(result => result === "stored")).toHaveLength(1);
    expect(await redis(["LLEN", list])).toBe(1000);
    const quotas: string[] = await redis(["KEYS", "doodle:diagnostics:quota:*"]); expect(quotas).toHaveLength(5);
  });

  it("charges duplicate upload attempts so retries cannot bypass the hourly quota", async () => {
    const failure = event();
    const results = await Promise.all(Array.from({ length: 65 }, () => ingestClientDiagnostics([failure], "192.0.2.10", day)));
    expect(results.filter(result => result === "stored")).toHaveLength(60);
    expect(results.filter(result => result === "rate_limited")).toHaveLength(5);
    expect(await redis(["LLEN", list])).toBe(1);
  });
  it("bounds hourly global attempts before allocating additional client keys", async () => {
    await redis(["SET", "doodle:diagnostics:attempts:2026-10-02T08", "1000", "EX", 3600]);
    expect(await ingestClientDiagnostics([event()], "192.0.2.11", day)).toBe("rate_limited");
    expect(await redis(["KEYS", "doodle:diagnostics:quota:*"])).toEqual([]);
  });


  it("does not let an already blocked client exhaust the shared hourly quota", async () => {
    const failure = event();
    for (let i = 0; i < 60; i++) await ingestClientDiagnostics([failure], "192.0.2.20", day);
    for (let i = 0; i < 5; i++) expect(await ingestClientDiagnostics([failure], "192.0.2.20", day)).toBe("rate_limited");
    expect(await redis(["GET", "doodle:diagnostics:attempts:2026-10-02T08"])).toBe("60");
    expect(await ingestClientDiagnostics([event()], "192.0.2.21", day)).toBe("stored");
  });

  it("caps server retention independently from untrusted client reports", async () => {
    const key = "doodle:diagnostics:server:day:2026-10-02";
    await redis(["RPUSH", key, ...Array.from({ length: 999 }, () => "{}")]);
    await Promise.all(Array.from({ length: 5 }, () => recordServerDiagnostic({ source: "server", timestamp: day.toISOString(), requestId: randomUUID(), operation: "generation", stage: "image_provider", code: "timeout", status: 504, channel: "android", durationMs: 150000 })));
    expect(await redis(["LLEN", key])).toBe(1000);
    expect(await redis(["TTL", key])).toBeGreaterThan(2591900);
  });
});
