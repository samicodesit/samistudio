import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const redis = vi.hoisted(() => ({ command: vi.fn(), after: vi.fn() }));
vi.mock("@/lib/redis", () => ({ redisCommand: redis.command }));
vi.mock("next/server", () => ({ after: redis.after }));
import { ingestClientDiagnostics, recordServerDiagnostic, trackServerDiagnostic } from "./store";
const event = { v: 1 as const, id: "df9c4bb8-4ab8-49d6-a938-e0ed35616729", timestamp: "2026-10-02T08:01:00.000Z", appVersion: "1.0.0", build: "7", androidApi: 35, operation: "generation" as const, stage: "http_request" as const, code: "network" as const };
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("SESSION_SECRET", "test-secret"); redis.command.mockResolvedValue(1); });
describe("bounded diagnostic retention", () => {
  it("uses one atomic bounded write, a timeout and a pseudonymous short-lived quota key", async () => {
    expect(await ingestClientDiagnostics([event], "192.0.2.1", new Date("2026-10-02T08:13:00Z"))).toBe("stored");
    const [command, signal] = redis.command.mock.calls[0];
    expect(command[0]).toBe("EVAL"); expect(command[1]).toContain("EXPIRE");
    expect(command[1]).toContain("SISMEMBER"); expect(command[1]).toContain("1000");
    expect(JSON.stringify(command)).not.toContain("192.0.2.1");
    expect(command).toContain("doodle:diagnostics:client:day:2026-10-02");
    expect(signal).toBeInstanceOf(AbortSignal);
  });
  it("distinguishes quota exhaustion and unavailable storage for safe retries", async () => {
    redis.command.mockResolvedValueOnce(-1).mockRejectedValueOnce(new Error("secret"));
    expect(await ingestClientDiagnostics([event], "unknown")).toBe("rate_limited");
    expect(await ingestClientDiagnostics([event], "unknown")).toBe("unavailable");
  });
  it("cannot let retention failure affect the business response", async () => {
    redis.command.mockRejectedValue(new Error("token"));
    await expect(recordServerDiagnostic({ source: "server", timestamp: event.timestamp, requestId: event.id, operation: "generation", stage: "image_provider", code: "timeout", status: 504, channel: "android", durationMs: 10 })).resolves.toBeUndefined();
  });
  it("schedules production retention after the response", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    trackServerDiagnostic({ source: "server", timestamp: event.timestamp, requestId: event.id, operation: "generation", stage: "image_provider", code: "timeout", status: 504, channel: "android", durationMs: 10 });
    expect(redis.after).toHaveBeenCalledWith(expect.any(Function));
  });
});
