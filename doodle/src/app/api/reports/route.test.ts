import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  clientHashForReport: vi.fn(),
  storeReport: vi.fn(),
}));
vi.mock("@/lib/reports/report-store", () => mocks);

function request(body: string, origin = "http://localhost:3000", contentLength?: number) {
  return new NextRequest("http://localhost:3000/api/reports", {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      ...(contentLength === undefined ? {} : { "content-length": String(contentLength) }),
    },
    body,
  });
}

describe("report route", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.clientHashForReport.mockReturnValue("a".repeat(64));
    mocks.storeReport.mockResolvedValue("stored");
  });

  it("stores a same-origin report and returns a reference ID", async () => {
    const response = await POST(request(JSON.stringify({
      reason: "violence",
      details: "Unexpected injury",
      locale: "en",
      includeContent: false,
    })));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    expect(mocks.storeReport).toHaveBeenCalledWith(expect.objectContaining({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      reason: "violence",
      includeContent: false,
    }), "a".repeat(64));
  });

  it("rejects cross-origin and oversized requests before storage", async () => {
    const crossOrigin = await POST(request("{}", "https://evil.example"));
    const oversized = await POST(request("{}", "http://localhost:3000", 500_000));
    const streamedOversized = await POST(request(`"${"x".repeat(120_000)}"`));

    expect(crossOrigin.status).toBe(403);
    expect(oversized.status).toBe(413);
    expect(streamedOversized.status).toBe(413);
    expect(mocks.storeReport).not.toHaveBeenCalled();
  });

  it("rejects content supplied without consent before storage", async () => {
    const response = await POST(request(JSON.stringify({
      reason: "hate",
      details: "",
      locale: "en",
      includeContent: false,
      scene: "private description",
    })));

    expect(response.status).toBe(400);
    expect(mocks.storeReport).not.toHaveBeenCalled();
  });

  it("does not claim acceptance when storage is limited or unavailable", async () => {
    mocks.storeReport.mockResolvedValueOnce("rate_limited").mockResolvedValueOnce("capacity").mockRejectedValueOnce(new Error("offline"));

    expect((await POST(request(JSON.stringify({ reason: "hate", details: "", locale: "en", includeContent: false })))).status).toBe(429);
    expect((await POST(request(JSON.stringify({ reason: "hate", details: "", locale: "en", includeContent: false })))).status).toBe(503);
    expect((await POST(request(JSON.stringify({ reason: "hate", details: "", locale: "en", includeContent: false })))).status).toBe(503);
  });
});
