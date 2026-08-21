import { beforeEach, describe, expect, it, vi } from "vitest";
import { fulfillCreditPack, getPaidBalance, refundPaidCredit, reservePaidCredit } from "./credits";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => {
  const rpc = vi.fn();
  const maybeSingle = vi.fn();
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { eq, from, maybeSingle, rpc, select };
});

vi.mock("@/lib/supabase/admin", () => ({
  getAdminSupabase: () => ({ from: mocks.from, rpc: mocks.rpc }),
}));

describe("paid credits", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockClear());
  });

  it("reads a missing paid balance as zero", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(getPaidBalance("user")).resolves.toBe(0);
    expect(mocks.from).toHaveBeenCalledWith("credit_balances");
    expect(mocks.select).toHaveBeenCalledWith("balance");
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "user");
  });

  it("maps -1 to an empty paid balance", async () => {
    mocks.rpc.mockResolvedValue({ data: -1, error: null });

    await expect(reservePaidCredit("user", "reservation")).resolves.toEqual({ reserved: false, remaining: 0 });
  });

  it("returns the balance after one reservation", async () => {
    mocks.rpc.mockResolvedValue({ data: 9, error: null });

    await expect(reservePaidCredit("user", "reservation")).resolves.toEqual({ reserved: true, remaining: 9 });
    expect(mocks.rpc).toHaveBeenCalledWith("reserve_paid_credit", {
      p_user_id: "user",
      p_reservation_id: "reservation",
    });
  });

  it("throws instead of guessing when Supabase fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("offline") });

    await expect(refundPaidCredit("user", "reservation")).rejects.toThrow("offline");
  });

  it("fulfills a pack with the exact idempotency identifiers", async () => {
    mocks.rpc.mockResolvedValue({ data: 10, error: null });

    await expect(fulfillCreditPack("user", "checkout", "payment")).resolves.toBe(10);
    expect(mocks.rpc).toHaveBeenCalledWith("fulfill_credit_pack", {
      p_user_id: "user",
      p_checkout_session_id: "checkout",
      p_payment_intent_id: "payment",
    });
  });
});
