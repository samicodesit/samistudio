import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  fulfillCheckout: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/billing/checkout", () => ({ fulfillCheckout: mocks.fulfillCheckout }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));

function request(body?: unknown, origin = "https://doodle.test", query = "") {
  return new NextRequest("https://doodle.test/api/checkout/confirm" + query, {
    method: "POST",
    headers: { host: "doodle.test", origin, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("checkout confirmation route", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getCurrentUser.mockResolvedValue({ id: "user", email: "buyer@example.com" });
  });

  it("rejects cross-origin confirmation before authentication", async () => {
    const response = await POST(request({ sessionId: "cs_paid" }, "https://evil.test"));

    expect(response.status).toBe(403);
    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
    expect(mocks.fulfillCheckout).not.toHaveBeenCalled();
  });

  it("does not treat a query session ID as payment proof", async () => {
    const response = await POST(request(undefined, "https://doodle.test", "?sessionId=cs_query"));

    expect(response.status).toBe(400);
    expect(mocks.fulfillCheckout).not.toHaveBeenCalled();
  });

  it("requires authentication before fulfillment", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const response = await POST(request({ sessionId: "cs_paid" }));

    expect(response.status).toBe(401);
    expect(mocks.fulfillCheckout).not.toHaveBeenCalled();
  });

  it("retrieves and validates the session for the authenticated user", async () => {
    mocks.fulfillCheckout.mockResolvedValue(10);

    const response = await POST(request({ sessionId: "cs_paid" }));

    expect(await response.json()).toEqual({ balance: 10 });
    expect(mocks.fulfillCheckout).toHaveBeenCalledWith("cs_paid", "user");
  });

  it("does not report a balance when session validation or billing fails", async () => {
    mocks.fulfillCheckout.mockRejectedValue(new Error("session does not match"));

    const response = await POST(request({ sessionId: "cs_untrusted" }));

    expect(response.status).toBe(503);
  });
});
