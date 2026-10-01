// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordUsage, trackUsage } from "./usage-metrics";

vi.mock("server-only", () => ({}));
const schedule = vi.hoisted(() => vi.fn());
vi.mock("next/server", () => ({ after: schedule }));
const event = { metric: "drawings", channel: "web", id: "one", actor: "trial:one" } as const;

describe("non-blocking counting", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    schedule.mockReset();
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("KV_REST_API_URL", "https://redis.example");
    vi.stubEnv("KV_REST_API_TOKEN", "local-only");
  });
  it("does not throw or log user data when the request scheduler is unavailable", () => {
    schedule.mockImplementation(() => { throw new Error("private scheduler error"); });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => trackUsage(event)).not.toThrow();
    expect(warning).toHaveBeenCalledExactlyOnceWith("[doodle-metrics] scheduling unavailable");
  });
  it("aborts a hung metrics write without rejecting the background task", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let wasAborted = false;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, options) => {
      return new Promise<Response>((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => {
          wasAborted = true;
          reject(new Error("aborted"));
        }, { once: true });
      });
    });
    await expect(recordUsage(event)).resolves.toBeUndefined();
    expect(wasAborted).toBe(true);
  });
});
