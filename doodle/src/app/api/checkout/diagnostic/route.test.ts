import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));

function request(body: unknown, origin = "https://doodle.test") {
  return new NextRequest("https://doodle.test/api/checkout/diagnostic", {
    method: "POST",
    headers: { host: "doodle.test", origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Apple Pay diagnostic route", () => {
  let userSequence = 0;

  beforeEach(() => {
    mocks.getCurrentUser.mockReset();
    userSequence += 1;
    mocks.getCurrentUser.mockResolvedValue({ id: `diagnostic-user-${userSequence}`, email: "ignored@example.com" });
  });

  it("requires same-origin authentication", async () => {
    expect((await POST(request({ stage: "express_ready", applePay: "available" }, "https://evil.test"))).status).toBe(403);
    mocks.getCurrentUser.mockResolvedValue(null);
    expect((await POST(request({ stage: "express_ready", applePay: "available" }))).status).toBe(401);
  });

  it("accepts only a bounded lifecycle event and logs its sanitized shape", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const response = await POST(request({ stage: "express_ready", applePay: "available" }));

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(info).toHaveBeenCalledWith("[apple-pay-diagnostic]", JSON.stringify({ stage: "express_ready", applePay: "available" }));
    info.mockRestore();
  });

  it("rejects malformed, oversized, and extra-field payloads without logging", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    expect((await POST(request({ stage: "express_ready", applePay: "available", secret: "hidden" }))).status).toBe(400);
    expect((await POST(request({ stage: "express_ready", applePay: "maybe" }))).status).toBe(400);
    expect((await POST(request("not an object"))).status).toBe(400);
    expect((await POST(request({ stage: "express_ready", applePay: "available", filler: "x".repeat(600) }))).status).toBe(413);
    expect(info).not.toHaveBeenCalled();
    info.mockRestore();
  });

  it("keeps returning success after the per-account log budget is exhausted", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const event = { stage: "provider", outcome: "success", reason: "ready" } as const;

    for (let index = 0; index < 26; index += 1) {
      expect((await POST(request(event))).status).toBe(204);
    }

    expect(info).toHaveBeenCalledTimes(24);
    info.mockRestore();
  });
});
