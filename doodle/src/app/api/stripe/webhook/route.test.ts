import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  fulfillCheckout: vi.fn(),
  getStripe: vi.fn(),
}));

vi.mock("@/lib/billing/stripe", () => ({
  getStripe: mocks.getStripe,
}));
vi.mock("@/lib/billing/checkout", () => ({ fulfillCheckout: mocks.fulfillCheckout }));

function webhookRequest(body: string, signature?: string) {
  return new NextRequest("https://doodle.test/api/stripe/webhook", {
    method: "POST",
    headers: signature ? { "stripe-signature": signature } : undefined,
    body,
  });
}

describe("Stripe webhook route", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.fulfillCheckout.mockResolvedValue(10);
    mocks.getStripe.mockReturnValue({ webhooks: { constructEvent: mocks.constructEvent } });
  });

  it("rejects a missing signature without parsing or fulfillment", async () => {
    const response = await POST(webhookRequest("payload"));

    expect(response.status).toBe(400);
    expect(mocks.constructEvent).not.toHaveBeenCalled();
    expect(mocks.fulfillCheckout).not.toHaveBeenCalled();
  });

  it("rejects an invalid Stripe signature", async () => {
    mocks.constructEvent.mockImplementation(() => {
      throw new Error("bad signature");
    });

    const response = await POST(webhookRequest("payload", "bad"));

    expect(response.status).toBe(400);
    expect(mocks.fulfillCheckout).not.toHaveBeenCalled();
  });

  it("returns 500 when Stripe client initialization fails", async () => {
    mocks.getStripe.mockImplementation(() => {
      throw new Error("Stripe configuration unavailable");
    });

    const response = await POST(webhookRequest("payload", "valid"));

    expect(response.status).toBe(500);
    expect(mocks.constructEvent).not.toHaveBeenCalled();
    expect(mocks.fulfillCheckout).not.toHaveBeenCalled();
  });

  it("verifies the untouched raw body with the endpoint secret", async () => {
    mocks.constructEvent.mockReturnValue({ type: "payment_intent.created", data: { object: {} } });
    const rawBody = '{\n  "id": "evt_raw"\n}\n';

    const response = await POST(webhookRequest(rawBody, "valid"));

    expect(response.status).toBe(200);
    expect(mocks.constructEvent).toHaveBeenCalledWith(rawBody, "valid", "whsec_test");
  });

  it.each(["checkout.session.completed", "checkout.session.async_payment_succeeded"])(
    "fulfills %s",
    async (type) => {
      mocks.constructEvent.mockReturnValue({ type, data: { object: { id: "cs_paid" } } });

      const response = await POST(webhookRequest("payload", "valid"));

      expect(response.status).toBe(200);
      expect(mocks.fulfillCheckout).toHaveBeenCalledWith("cs_paid");
    },
  );

  it("acknowledges unrelated valid events without fulfillment", async () => {
    mocks.constructEvent.mockReturnValue({ type: "payment_intent.created", data: { object: {} } });

    const response = await POST(webhookRequest("payload", "valid"));

    expect(response.status).toBe(200);
    expect(mocks.fulfillCheckout).not.toHaveBeenCalled();
  });

  it("returns 500 for valid fulfillment failures so Stripe retries", async () => {
    mocks.constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { id: "cs_paid" } },
    });
    mocks.fulfillCheckout.mockRejectedValue(new Error("database unavailable"));

    const response = await POST(webhookRequest("payload", "valid"));

    expect(response.status).toBe(500);
  });
});
