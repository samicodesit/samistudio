import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { GenerationError } from "@/lib/generation/generate-doodle";

const mocks = vi.hoisted(() => ({
  authorizeGeneration: vi.fn(),
  generateDoodle: vi.fn(),
}));

vi.mock("@/lib/auth/authorize-generation", () => ({
  authorizeGeneration: mocks.authorizeGeneration,
}));
vi.mock("@/lib/generation/generate-doodle", async () => {
  const actual = await vi.importActual<typeof import("@/lib/generation/generate-doodle")>("@/lib/generation/generate-doodle");
  return { ...actual, generateDoodle: mocks.generateDoodle };
});

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
    mocks.authorizeGeneration.mockResolvedValue({ authorized: true, subject: "private-owner" });
    mocks.generateDoodle.mockReset();
  });

  it("rejects an unauthorized request", async () => {
    mocks.authorizeGeneration.mockResolvedValueOnce({ authorized: false, subject: null });
    const response = await POST(request("Two cats hug"));
    expect(response.status).toBe(401);
    expect(mocks.generateDoodle).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin request before authorizing generation", async () => {
    const response = await POST(request("Two cats hug", "https://evil.example"));
    expect(response.status).toBe(403);
    expect(mocks.authorizeGeneration).not.toHaveBeenCalled();
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
