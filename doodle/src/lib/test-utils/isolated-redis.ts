import { execFile, spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import { promisify } from "node:util";
const run = promisify(execFile);
export function isolatedRedis() {
  let port = 0, directory = "";
  let process: ChildProcess | undefined;
  const command = async (args: unknown[]) => {
    const result = await run("redis-cli", ["-h", "127.0.0.1", "-p", String(port), "--json", ...args.map(String)], { maxBuffer: 1_000_000 });
    return JSON.parse(result.stdout.trim()) as unknown;
  };
  return { command,
    async start() {
      const server = createServer(); await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
      const address = server.address(); if (!address || typeof address === "string") throw Error("No isolated Redis port"); port = address.port;
      await new Promise<void>(resolve => server.close(() => resolve()));
      directory = mkdtempSync(`${tmpdir()}/doodle-apple-attest-`);
      process = spawn("redis-server", ["--bind", "127.0.0.1", "--port", String(port), "--save", "", "--appendonly", "no", "--dir", directory], { stdio: "ignore" });
      for (let i = 0; i < 50; i++) { try { if (await command(["PING"]) === "PONG") return; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); }
      throw Error("Isolated Redis unavailable");
    },
    async stop() {
      if (process && process.exitCode === null) { const ended = new Promise<void>(resolve => process!.once("exit", () => resolve())); process.kill("SIGTERM"); await ended; }
      if (directory) rmSync(directory, { recursive: true, force: true });
    },
  };
}
