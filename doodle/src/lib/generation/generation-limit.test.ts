import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkGenerationLimit } from "./generation-limit";

describe("checkGenerationLimit", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("allows the exact daily boundaries and sends an atomic, privacy-safe counter command", async () => {
    vi.stubEnv("KV_REST_API_URL", "https://redis.example");
    vi.stubEnv("KV_REST_API_TOKEN", "token");
    vi.stubEnv("SESSION_SECRET", "pepper");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ result: [20, 200] }), { status: 200 }),
    );

    const request = new Request("https://doodle.example/api/generate", {
      headers: { "x-vercel-forwarded-for": "203.0.113.8" },
    });

    await expect(checkGenerationLimit(request)).resolves.toBe("allowed");
    const [, options] = fetchMock.mock.calls[0];
    const command = JSON.parse(String(options?.body));
    const expectedClient = createHmac("sha256", "pepper").update("203.0.113.8").digest("hex");
    expect(command.slice(0, 3)).toEqual(["EVAL", expect.any(String), "2"]);
    expect(command[3]).toContain(expectedClient);
    expect(command.slice(5)).toEqual([20, 200, 172_800]);
  });

  it("fails closed before Redis when SESSION_SECRET is missing", async () => {
    vi.stubEnv("KV_REST_API_URL", "https://redis.example");
    vi.stubEnv("KV_REST_API_TOKEN", "token");
    vi.stubEnv("SESSION_SECRET", "");
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(
      checkGenerationLimit(new Request("https://doodle.example/api/generate")),
    ).resolves.toBe("unavailable");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
