import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  checkBotId: vi.fn(),
  createPackCheckout: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock("botid/server", () => ({ checkBotId: mocks.checkBotId }));
vi.mock("@/lib/billing/checkout", () => ({ createPackCheckout: mocks.createPackCheckout }));
vi.mock("@/lib/supabase/session", () => ({ getCurrentUser: mocks.getCurrentUser }));

function request(locale: unknown, origin = "https://doodle.test", query = "") {
  return new NextRequest("https://doodle.test/api/checkout" + query, {
    method: "POST",
    headers: { host: "doodle.test", origin, "content-type": "application/json" },
    body: JSON.stringify({ locale }),
  });
}

function malformedRequest() {
  return new NextRequest("https://doodle.test/api/checkout", {
    method: "POST",
    headers: { host: "doodle.test", origin: "https://doodle.test", "content-type": "application/json" },
    body: "not json",
  });
}

describe("checkout route", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.checkBotId.mockResolvedValue({ isBot: false });
    mocks.getCurrentUser.mockResolvedValue({ id: "user", email: "buyer@example.com" });
  });

  it("rejects cross-origin requests before BotID or authentication", async () => {
    const response = await POST(request("en", "https://evil.test"));

    expect(response.status).toBe(403);
    expect(mocks.checkBotId).not.toHaveBeenCalled();
    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
    expect(mocks.createPackCheckout).not.toHaveBeenCalled();
  });

  it("rejects bots before parsing locale or authenticating", async () => {
    mocks.checkBotId.mockResolvedValue({ isBot: true });

    const response = await POST(request("not-a-locale"));

    expect(response.status).toBe(403);
    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
    expect(mocks.createPackCheckout).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON after the origin and BotID checks", async () => {
    const response = await POST(malformedRequest());

    expect(response.status).toBe(400);
    expect(mocks.checkBotId).toHaveBeenCalledOnce();
    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
  });

  it("accepts only a body locale from the fixed locale set", async () => {
    const response = await POST(request("unknown", "https://doodle.test", "?locale=de"));

    expect(response.status).toBe(400);
    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
    expect(mocks.createPackCheckout).not.toHaveBeenCalled();
  });

  it("requires authentication before creating Checkout", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const response = await POST(request("en"));

    expect(response.status).toBe(401);
    expect(mocks.createPackCheckout).not.toHaveBeenCalled();
  });

  it("returns only Stripe's hosted URL for a known locale", async () => {
    mocks.createPackCheckout.mockResolvedValue({ url: "https://checkout.stripe.com/test" });

    const response = await POST(request("de"));

    expect(await response.json()).toEqual({ url: "https://checkout.stripe.com/test" });
    expect(mocks.createPackCheckout).toHaveBeenCalledWith({
      userId: "user",
      email: "buyer@example.com",
      locale: "de",
      origin: "https://doodle.test",
    });
  });

  it("returns 503 when Stripe fails to create Checkout", async () => {
    mocks.createPackCheckout.mockRejectedValue(new Error("Stripe unavailable"));

    expect((await POST(request("en"))).status).toBe(503);
  });

  it("returns 503 when Stripe does not provide a hosted URL", async () => {
    mocks.createPackCheckout.mockResolvedValue({ url: null });

    expect((await POST(request("en"))).status).toBe(503);
  });
});
