import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { GenerationError } from "@/lib/generation/generate-doodle";

const mocks = vi.hoisted(() => ({
  generateDoodle: vi.fn(),
  checkBotId: vi.fn(),
}));

vi.mock("@/lib/generation/generate-doodle", async () => {
  const actual = await vi.importActual<typeof import("@/lib/generation/generate-doodle")>("@/lib/generation/generate-doodle");
  return { ...actual, generateDoodle: mocks.generateDoodle };
});

vi.mock("botid/server", () => ({ checkBotId: mocks.checkBotId }));

function request(scene: unknown, origin = "http://localhost:3000") {
  return new NextRequest("http://localhost:3000/api/generate", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin,
      "content-type": "application/json",
    },
    body: JSON.stringify({ scene }),
  });
}

describe("generate route", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    mocks.generateDoodle.mockReset();
    mocks.checkBotId.mockReset();
    mocks.checkBotId.mockResolvedValue({ isBot: false });
  });

  it("allows an anonymous same-origin request", async () => {
    mocks.generateDoodle.mockResolvedValue({ bytes: Buffer.from("png"), mimeType: "image/png" });
    const response = await POST(request("Two cats hug"));
    expect(response.status).toBe(200);
  });

  it("rejects a cross-origin request before generation", async () => {
    const response = await POST(request("Two cats hug", "https://evil.example"));
    expect(response.status).toBe(403);
    expect(mocks.generateDoodle).not.toHaveBeenCalled();
  });

  it("rejects a detected bot before generation", async () => {
    mocks.checkBotId.mockResolvedValueOnce({ isBot: true });

    const response = await POST(request("Two cats hug"));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "bot_detected" });
    expect(mocks.generateDoodle).not.toHaveBeenCalled();
  });

  it("rejects invalid scenes without calling OpenAI", async () => {
    const response = await POST(request(" "));
    expect(response.status).toBe(400);
    expect(mocks.generateDoodle).not.toHaveBeenCalled();
  });

  it("rejects an over-limit scene without calling OpenAI", async () => {
    const response = await POST(request("x".repeat(181)));
    expect(response.status).toBe(400);
    expect(mocks.generateDoodle).not.toHaveBeenCalled();
  });

  it.each([
    { result: [21, -1], bucket: "per-client" },
    { result: [1, 201], bucket: "global" },
  ])("returns 429 when the $bucket daily generation limit is reached", async ({ result }) => {
    vi.stubEnv("KV_REST_API_URL", "https://redis.example");
    vi.stubEnv("KV_REST_API_TOKEN", "secret");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ result }), { status: 200 }),
    );

    const limitedRequest = request("Two cats hug");
    limitedRequest.headers.set("x-vercel-forwarded-for", "203.0.113.8");
    const response = await POST(limitedRequest);

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "rate_limited" });
    expect(mocks.generateDoodle).not.toHaveBeenCalled();
  });

  it("fails closed when the daily limit store is unavailable", async () => {
    vi.stubEnv("KV_REST_API_URL", "https://redis.example");
    vi.stubEnv("KV_REST_API_TOKEN", "secret");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    const response = await POST(request("Two cats hug"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "limit_unavailable" });
    expect(mocks.generateDoodle).not.toHaveBeenCalled();
  });

  it("returns a PNG without caching on success", async () => {
    mocks.generateDoodle.mockResolvedValue({ bytes: Buffer.from("png"), mimeType: "image/png" });
    const response = await POST(request("Two cats hug"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/png");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("png");
  });

  it.each([
    [new GenerationError("refused", "no"), 422],
    [new GenerationError("timeout", "no"), 504],
    [new GenerationError("upstream", "no"), 502],
    [new GenerationError("malformed", "no"), 502],
  ])("maps %s failures to %s", async (error, status) => {
    mocks.generateDoodle.mockRejectedValueOnce(error);
    const response = await POST(request("Two cats hug"));
    expect(response.status).toBe(status);
  });
});
