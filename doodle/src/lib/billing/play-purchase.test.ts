import { beforeEach, describe, expect, it, vi } from "vitest";
import { processPlayPurchase, type PlayPublisherClient, type ProductPurchaseV2 } from "./play-purchase";

vi.mock("server-only", () => ({}));
const ledger = vi.hoisted(() => ({ claimPlayCredits: vi.fn(), getPlayCreditClaim: vi.fn(), markPlayPurchaseConsumed: vi.fn() }));
vi.mock("./play-credits", () => ledger);

const basePurchase: ProductPurchaseV2 = {
  purchaseStateContext: { purchaseState: "PURCHASED" },
  obfuscatedExternalAccountId: "bound-account",
  productLineItem: [{
    productId: "doodle_credits_10",
    productOfferDetails: { quantity: 1, refundableQuantity: 1, consumptionState: "CONSUMPTION_STATE_YET_TO_BE_CONSUMED" },
  }],
};

function client(purchase = basePurchase): PlayPublisherClient {
  return { getProductPurchase: vi.fn().mockResolvedValue(purchase), consumeProductPurchase: vi.fn().mockResolvedValue(undefined) };
}

describe("Play purchase processing", () => {
  beforeEach(() => {
    Object.values(ledger).forEach((mock) => mock.mockReset());
    ledger.claimPlayCredits.mockResolvedValue({ granted: true, balance: 10 });
    ledger.markPlayPurchaseConsumed.mockResolvedValue(undefined);
  });

  it("verifies binding and product before granting, then consumes server-side", async () => {
    const publisher = client();
    await expect(processPlayPurchase({ accountId: "account", expectedObfuscatedAccountId: "bound-account", purchaseToken: "token", productId: "doodle_credits_10", publisher })).resolves.toEqual({ status: "granted", balance: 10 });
    expect(ledger.claimPlayCredits).toHaveBeenCalledWith("account", "token");
    expect(publisher.consumeProductPurchase).toHaveBeenCalledWith("doodle_credits_10", "token");
    expect(ledger.markPlayPurchaseConsumed).toHaveBeenCalledWith("account", "token");
  });

  it.each([
    [{ ...basePurchase, purchaseStateContext: { purchaseState: "PENDING" } }, "pending"],
    [{ ...basePurchase, purchaseStateContext: { purchaseState: "CANCELLED" } }, "invalid"],
    [{ ...basePurchase, obfuscatedExternalAccountId: undefined }, "foreign"],
    [{ ...basePurchase, obfuscatedExternalAccountId: "someone-else" }, "foreign"],
    [{ ...basePurchase, productLineItem: [{ productId: "other", productOfferDetails: { quantity: 1, refundableQuantity: 1, consumptionState: "CONSUMPTION_STATE_YET_TO_BE_CONSUMED" } }] }, "invalid"],
    [{ ...basePurchase, productLineItem: [{ productId: "doodle_credits_10", productOfferDetails: { quantity: 1, refundableQuantity: 0, consumptionState: "CONSUMPTION_STATE_YET_TO_BE_CONSUMED" } }] }, "invalid"],
  ])("never grants an ineligible purchase %#", async (purchase, kind) => {
    await expect(processPlayPurchase({ accountId: "account", expectedObfuscatedAccountId: "bound-account", purchaseToken: "token", productId: "doodle_credits_10", publisher: client(purchase) })).rejects.toMatchObject({ kind });
    expect(ledger.claimPlayCredits).not.toHaveBeenCalled();
  });

  it("returns granted-but-unconsumed after a consume failure and retries without double grant", async () => {
    const publisher = client();
    vi.mocked(publisher.consumeProductPurchase).mockRejectedValue(new Error("offline"));
    await expect(processPlayPurchase({ accountId: "account", expectedObfuscatedAccountId: "bound-account", purchaseToken: "token", productId: "doodle_credits_10", publisher })).resolves.toEqual({ status: "granted_consume_pending", balance: 10 });
  });

  it("accepts an already consumed token only when its local claim exists", async () => {
    ledger.getPlayCreditClaim.mockResolvedValue({ balance: 19, state: "granted" });
    const purchase: ProductPurchaseV2 = { ...basePurchase, productLineItem: [{ ...basePurchase.productLineItem![0], productOfferDetails: { quantity: 1, refundableQuantity: 1, consumptionState: "CONSUMPTION_STATE_CONSUMED" } }] };
    await expect(processPlayPurchase({ accountId: "account", expectedObfuscatedAccountId: "bound-account", purchaseToken: "token", productId: "doodle_credits_10", publisher: client(purchase) })).resolves.toEqual({ status: "already_granted", balance: 19 });
    expect(ledger.claimPlayCredits).not.toHaveBeenCalled();
    expect(ledger.markPlayPurchaseConsumed).toHaveBeenCalledWith("account", "token");
  });
});
