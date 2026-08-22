import { beforeEach, describe, expect, it, vi } from "vitest";
import { redisCommand, redisInteger } from "./redis";

vi.mock("server-only", () => ({}));

describe("Redis REST boundary", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("KV_REST_API_URL", "https://redis.example");
    vi.stubEnv("KV_REST_API_TOKEN", "token");
  });

  it("sends one no-store Redis command and returns its result", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ result: "value" }), { status: 200 }));

    await expect(redisCommand(["GET", "key"])).resolves.toBe("value");
    expect(fetch).toHaveBeenCalledWith(
      "https://redis.example",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
        body: JSON.stringify(["GET", "key"]),
        cache: "no-store",
      }),
    );
  });

  it.each([
    ["credentials are missing", async () => {
      vi.stubEnv("KV_REST_API_URL", "");
      await redisCommand(["GET", "key"]);
    }],
    ["Redis rejects the request", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("no", { status: 503 }));
      await redisCommand(["GET", "key"]);
    }],
    ["Redis returns malformed JSON", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("not json", { status: 200 }));
      await redisCommand(["GET", "key"]);
    }],
    ["Redis response has no result", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      await redisCommand(["GET", "key"]);
    }],
  ])("fails safely when %s", async (_name, run) => {
    await expect(run()).rejects.toThrow("Redis unavailable");
  });

  it("accepts only safe integer Redis values", () => {
    expect(redisInteger("-12")).toBe(-12);
    expect(redisInteger(8)).toBe(8);
    expect(() => redisInteger("1.5")).toThrow("Redis unavailable");
    expect(() => redisInteger(Number.MAX_SAFE_INTEGER + 1)).toThrow("Redis unavailable");
  });
});
