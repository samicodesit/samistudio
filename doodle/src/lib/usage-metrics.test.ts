// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordOperation, recordUsage, trackOperation, trackUsage } from "./usage-metrics";

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
    wasAborted = false;
    await expect(recordOperation({ metric: "generation", channel: "web", outcome: "error" })).resolves.toBeUndefined();
    expect(wasAborted).toBe(true);
  });
  it("defers operational storage and ignores previews", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response('{"result":1}'));
    trackOperation({ metric: "generation", channel: "web", outcome: "timeout", durationMs: 60_000 });
    expect(fetch).not.toHaveBeenCalled();
    expect(schedule).toHaveBeenCalledOnce();
    await schedule.mock.calls[0][0]();
    expect(fetch).toHaveBeenCalledOnce();
    vi.stubEnv("VERCEL_ENV", "preview");
    trackOperation({ metric: "checkout", channel: "web", outcome: "created" });
    expect(schedule).toHaveBeenCalledOnce();
  });
  it("cannot interrupt a response when operational scheduling fails", () => {
    schedule.mockImplementation(() => { throw new Error("private scheduler error"); });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => trackOperation({ metric: "checkout", channel: "web", outcome: "error" })).not.toThrow();
  });
  it("drops known tests, invalid tags and non-finite durations without transmitting private values", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response('{"result":1}'));
    await recordOperation({ metric: "checkout", channel: "web", outcome: "created", email: "SamiCodesIt@gmail.com" });
    expect(fetch).not.toHaveBeenCalled();
    await recordOperation({ metric: "generation", channel: "web", outcome: "private error" as "error" });
    expect(fetch).not.toHaveBeenCalled();
    await recordOperation({ metric: "generation", channel: "web", outcome: "success", durationMs: NaN, actor: "account:private", email: "buyer@example.com" });
    const body = String(fetch.mock.calls[0][1]?.body);
    expect(body).not.toMatch(/account:private|buyer@example|NaN/);
  });
});
