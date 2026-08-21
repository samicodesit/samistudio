import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPackCheckout, fulfillCheckout } from "./checkout";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  fulfillCreditPack: vi.fn(),
  getUserById: vi.fn(),
  retrieve: vi.fn(),
}));

vi.mock("./stripe", () => ({
  getStripe: () => ({ checkout: { sessions: { create: mocks.create, retrieve: mocks.retrieve } } }),
}));

vi.mock("./credits", () => ({ fulfillCreditPack: mocks.fulfillCreditPack }));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminSupabase: () => ({ auth: { admin: { getUserById: mocks.getUserById } } }),
}));

const USER_ID = "7d9ac733-9336-4c2a-93c1-5d597d0f7f8e";
const paidMatchingSession = {
  payment_status: "paid",
  metadata: { userId: USER_ID, pack: "doodle_10" },
  line_items: { data: [{ price: { id: "price_doodle" }, quantity: 1 }], has_more: false },
  payment_intent: "pi_paid",
};

function sessionWithPrice(price: string) {
  return {
    ...paidMatchingSession,
    line_items: { data: [{ price: { id: price }, quantity: 1 }], has_more: false },
  };
}

describe("fixed credit pack checkout", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("STRIPE_DOODLE_PRICE_ID", "price_doodle");
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getUserById.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    mocks.fulfillCreditPack.mockResolvedValue(10);
  });

  it("creates one fixed EUR pack with inclusive automatic tax", async () => {
    await createPackCheckout({
      userId: "user",
      email: "buyer@example.com",
      locale: "de",
      origin: "https://doodle.test",
    });

    expect(mocks.create).toHaveBeenCalledWith({
      mode: "payment",
      line_items: [{ price: "price_doodle", quantity: 1 }],
      automatic_tax: { enabled: true },
      adaptive_pricing: { enabled: false },
      allow_promotion_codes: false,
      client_reference_id: "user",
      customer_email: "buyer@example.com",
      metadata: { userId: "user", pack: "doodle_10" },
      locale: "de",
      success_url: "https://doodle.test/de?checkout={CHECKOUT_SESSION_ID}",
      cancel_url: "https://doodle.test/de?checkout=cancelled",
    });
  });

  it("uses Stripe's direct Brazilian locale and auto for unsupported Arabic", async () => {
    await createPackCheckout({ userId: "user", email: null, locale: "pt-br", origin: "https://doodle.test" });
    await createPackCheckout({ userId: "user", email: null, locale: "ar", origin: "https://doodle.test" });

    expect(mocks.create).toHaveBeenNthCalledWith(1, expect.objectContaining({ locale: "pt-BR" }));
    expect(mocks.create).toHaveBeenNthCalledWith(2, expect.objectContaining({ locale: "auto" }));
  });

  it("fulfills one paid matching pack", async () => {
    mocks.retrieve.mockResolvedValue(paidMatchingSession);

    await expect(fulfillCheckout("cs_paid", USER_ID)).resolves.toBe(10);
    expect(mocks.retrieve).toHaveBeenCalledWith("cs_paid", { expand: ["line_items"] });
    expect(mocks.getUserById).toHaveBeenCalledWith(USER_ID);
    expect(mocks.fulfillCreditPack).toHaveBeenCalledWith(USER_ID, "cs_paid", "pi_paid");
  });

  it("rejects one matching visible item when Stripe reports more line items", async () => {
    mocks.retrieve.mockResolvedValue({
      ...paidMatchingSession,
      line_items: { ...paidMatchingSession.line_items, has_more: true },
    });

    await expect(fulfillCheckout("cs_paginated", USER_ID)).rejects.toThrow();
    expect(mocks.fulfillCreditPack).not.toHaveBeenCalled();
  });

  it.each([
    ["unpaid", { ...paidMatchingSession, payment_status: "unpaid" }],
    ["wrong pack", { ...paidMatchingSession, metadata: { userId: USER_ID, pack: "other" } }],
    ["invalid user", { ...paidMatchingSession, metadata: { userId: "not-a-uuid", pack: "doodle_10" } }],
    ["wrong expected user", paidMatchingSession, "1d2cd760-c288-4ad7-8464-6d5db84eaf59"],
    ["extra line item", { ...paidMatchingSession, line_items: { data: [...paidMatchingSession.line_items.data, ...paidMatchingSession.line_items.data], has_more: false } }],
    ["wrong price", sessionWithPrice("price_other")],
    ["wrong quantity", { ...paidMatchingSession, line_items: { data: [{ price: { id: "price_doodle" }, quantity: 2 }], has_more: false } }],
    ["missing payment intent", { ...paidMatchingSession, payment_intent: null }],
  ])("rejects %s sessions", async (_label, session, expectedUserId = USER_ID) => {
    mocks.retrieve.mockResolvedValue(session);

    await expect(fulfillCheckout("cs_bad", expectedUserId)).rejects.toThrow();
    expect(mocks.getUserById).not.toHaveBeenCalled();
    expect(mocks.fulfillCreditPack).not.toHaveBeenCalled();
  });

  it("rejects a deleted user before granting credits", async () => {
    mocks.retrieve.mockResolvedValue(paidMatchingSession);
    mocks.getUserById.mockResolvedValue({ data: { user: null }, error: null });

    await expect(fulfillCheckout("cs_bad", USER_ID)).rejects.toThrow();
    expect(mocks.fulfillCreditPack).not.toHaveBeenCalled();
  });
});
