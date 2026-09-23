import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  checkBotId: vi.fn(),
  createPackElementsCheckout: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock("botid/server", () => ({ checkBotId: mocks.checkBotId }));
vi.mock("@/lib/billing/checkout", () => ({ createPackElementsCheckout: mocks.createPackElementsCheckout }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));

function request(locale: unknown, origin = "https://doodle.test") {
  return new NextRequest("https://doodle.test/api/checkout/elements", {
    method: "POST",
    headers: { host: "doodle.test", origin, "content-type": "application/json" },
    body: JSON.stringify({ locale }),
  });
}

describe("Elements checkout route", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.checkBotId.mockResolvedValue({ isBot: false });
    mocks.getCurrentUser.mockResolvedValue({ id: "user", email: "buyer@example.com" });
  });

  it("rejects cross-origin requests before creating a session", async () => {
    const response = await POST(request("en", "https://evil.test"));

    expect(response.status).toBe(403);
    expect(mocks.createPackElementsCheckout).not.toHaveBeenCalled();
  });

  it("requires authentication before creating an Elements session", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const response = await POST(request("en"));

    expect(response.status).toBe(401);
    expect(mocks.createPackElementsCheckout).not.toHaveBeenCalled();
  });

  it("returns only the client secret for the authenticated locale", async () => {
    mocks.createPackElementsCheckout.mockResolvedValue({ client_secret: "cs_secret_test" });

    const response = await POST(request("de"));

    expect(await response.json()).toEqual({ clientSecret: "cs_secret_test" });
    expect(mocks.createPackElementsCheckout).toHaveBeenCalledWith({
      userId: "user",
      email: "buyer@example.com",
      locale: "de",
      origin: "https://doodle.test",
    });
  });

  it("returns an unavailable response when Stripe has no client secret", async () => {
    mocks.createPackElementsCheckout.mockResolvedValue({ client_secret: null });

    expect((await POST(request("en"))).status).toBe(503);
  });
});
