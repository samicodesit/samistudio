// @vitest-environment node
import { execFile, spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import { promisify } from "node:util";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getFreeRemaining, reserveFreeDoodle, finalizeFreeDoodle, releaseFreeDoodle } from "./free-allowance";
const exec = promisify(execFile);
const available = spawnSync("redis-server", ["--version"], { stdio: "ignore" }).status === 0;
let port: number;
let dataDir: string;
let process: ChildProcess;
async function redis(command: unknown[]) {
  const result = await exec("redis-cli", ["-p", String(port), "--json", ...command.map(String)]);
  return JSON.parse(result.stdout.trim());
}

(available ? describe : describe.skip)("free trial against isolated Redis", () => {
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
  const identity = { id: "11111111-1111-4111-8111-111111111111" };
  beforeEach(async () => {
    vi.stubEnv("KV_REST_API_URL", "http://isolated-redis.test");
    vi.stubEnv("KV_REST_API_TOKEN", "local-only");
    await redis(["FLUSHDB"]);
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, options) =>
      new Response(JSON.stringify({ result: await redis(JSON.parse(String(options?.body))) })));
  });
  afterAll(async () => {
    vi.restoreAllMocks(); vi.unstubAllEnvs();
    process.kill("SIGTERM");
    await new Promise<void>(resolve => process.once("exit", () => resolve()));
    rmSync(dataDir, { recursive: true, force: true });
  });
  it("allows four holds under concurrency and never grants a fifth", async () => {
    const holds = await Promise.all(Array.from({ length: 8 }, (_, i) => reserveFreeDoodle(identity, String(i))));
    expect(holds.filter(x => x.reserved)).toHaveLength(4);
    expect(await getFreeRemaining(identity)).toBe(4);
    for (let i = 0; i < holds.length; i++) if (holds[i].reserved) {
      await finalizeFreeDoodle(identity, String(i));
      await finalizeFreeDoodle(identity, String(i));
    }
    expect(await getFreeRemaining(identity)).toBe(0);
    expect(await redis(["GET", `doodle:trial:used:${identity.id}`])).toBe("4");
    expect(await reserveFreeDoodle(identity, "fifth")).toEqual({ reserved: false, remaining: 0 });
  });
  it("preserves previous use and releases failed work without charging it", async () => {
    await redis(["SET", `doodle:trial:used:${identity.id}`, "2"]);
    expect(await getFreeRemaining(identity)).toBe(2);
    expect(await reserveFreeDoodle(identity, "failed")).toEqual({ reserved: true, remaining: 1 });
    await releaseFreeDoodle(identity, "failed");
    expect(await getFreeRemaining(identity)).toBe(2);
    await reserveFreeDoodle(identity, "third"); await finalizeFreeDoodle(identity, "third");
    await reserveFreeDoodle(identity, "fourth"); await finalizeFreeDoodle(identity, "fourth");
    expect(await getFreeRemaining(identity)).toBe(0);
  });
});
