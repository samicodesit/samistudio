import { describe, expect, it, vi } from "vitest";
import type { NativePlayConfig, NativePlayVerifyResponse } from "../contracts/native";
import { NativeBillingService, type IapModule } from "./billing";

const binding = "b".repeat(64);

function fakeIap() {
  let updated: ((purchase: any) => void) | undefined;
  const module: IapModule = {
    initConnection: vi.fn().mockResolvedValue(true),
    fetchProducts: vi.fn().mockResolvedValue([{ id: "doodle_credits_10", type: "in-app", displayPrice: "€4.99" }]),
    purchaseUpdatedListener: vi.fn((listener) => {
      updated = listener;
      return { remove: vi.fn() };
    }),
    purchaseErrorListener: vi.fn().mockReturnValue({ remove: vi.fn() }),
    requestPurchase: vi.fn().mockImplementation(async () => {
      updated?.({
        id: "purchase-1",
        productId: "doodle_credits_10",
        purchaseState: "purchased",
        purchaseToken: "token-1",
        obfuscatedAccountIdAndroid: binding,
        store: "google",
        quantity: 1,
        isAutoRenewing: false,
        transactionDate: Date.now(),
      });
    }),
    getAvailablePurchases: vi.fn().mockResolvedValue([]),
    finishTransaction: vi.fn().mockResolvedValue(undefined),
    endConnection: vi.fn().mockResolvedValue(undefined),
  };
  return module;
}

describe("NativeBillingService", () => {
  it("registers listeners before requesting a bound consumable and finishes after verify", async () => {
    const iap = fakeIap();
    const verify = vi.fn().mockResolvedValue({ status: "granted", balance: 10 } satisfies NativePlayVerifyResponse);
    const api = {
      getPlayConfig: vi.fn().mockResolvedValue({ enabled: true, productId: "doodle_credits_10", obfuscatedAccountId: binding } satisfies NativePlayConfig),
      verifyPlayPurchase: verify,
    };
    const billing = new NativeBillingService({ iap, api });

    await expect(billing.prepare()).resolves.toEqual({ productId: "doodle_credits_10", priceLabel: "€4.99" });
    await billing.buy();

    expect(iap.purchaseUpdatedListener).toHaveBeenCalledBefore(iap.requestPurchase as any);
    expect(verify).toHaveBeenCalledWith({ productId: "doodle_credits_10", purchaseToken: "token-1" });
    expect(iap.finishTransaction).toHaveBeenCalledWith(expect.objectContaining({ isConsumable: true }));
  });

  it("does not verify or finish a foreign account purchase", async () => {
    const iap = fakeIap();
    (iap.requestPurchase as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      const listener = (iap.purchaseUpdatedListener as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
      listener?.({ productId: "doodle_credits_10", purchaseState: "purchased", purchaseToken: "token-foreign", obfuscatedAccountIdAndroid: "c".repeat(64) });
    });
    const verify = vi.fn();
    const billing = new NativeBillingService({
      iap,
      api: {
        getPlayConfig: vi.fn().mockResolvedValue({ enabled: true, productId: "doodle_credits_10", obfuscatedAccountId: binding }),
        verifyPlayPurchase: verify,
      },
    });
    await billing.prepare();

    await expect(billing.buy()).rejects.toMatchObject({ code: "purchase_rejected" });
    expect(verify).not.toHaveBeenCalled();
    expect(iap.finishTransaction).not.toHaveBeenCalled();
  });

  it.each([undefined, null])("accepts a purchase callback without an obfuscated account binding (%s)", async (callbackBinding) => {
    const iap = fakeIap();
    (iap.requestPurchase as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      const listener = (iap.purchaseUpdatedListener as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
      listener?.({
        id: `purchase-missing-binding-${String(callbackBinding)}`,
        productId: "doodle_credits_10",
        purchaseState: "purchased",
        purchaseToken: "token-without-callback-binding",
        obfuscatedAccountIdAndroid: callbackBinding,
      });
    });
    const verify = vi.fn().mockResolvedValue({ status: "granted", balance: 10 } satisfies NativePlayVerifyResponse);
    const billing = new NativeBillingService({
      iap,
      api: {
        getPlayConfig: vi.fn().mockResolvedValue({ enabled: true, productId: "doodle_credits_10", obfuscatedAccountId: binding }),
        verifyPlayPurchase: verify,
      },
    });

    await billing.prepare();
    await expect(billing.buy()).resolves.toBeUndefined();

    expect(verify).toHaveBeenCalledWith({ productId: "doodle_credits_10", purchaseToken: "token-without-callback-binding" });
    expect(iap.finishTransaction).toHaveBeenCalledWith(expect.objectContaining({ isConsumable: true }));
  });

  it("leaves a pending purchase unfinished for recovery", async () => {
    const iap = fakeIap();
    (iap.getAvailablePurchases as ReturnType<typeof vi.fn>).mockResolvedValue([{
      productId: "doodle_credits_10",
      purchaseState: "purchased",
      purchaseToken: "token-pending",
      obfuscatedAccountIdAndroid: binding,
    }]);
    const verify = vi.fn().mockResolvedValue({ status: "granted_consume_pending", balance: 10 });
    const billing = new NativeBillingService({
      iap,
      api: {
        getPlayConfig: vi.fn().mockResolvedValue({ enabled: true, productId: "doodle_credits_10", obfuscatedAccountId: binding }),
        verifyPlayPurchase: verify,
      },
    });
    await billing.prepare();
    await billing.recoverPending();

    expect(verify).toHaveBeenCalledOnce();
    expect(iap.finishTransaction).not.toHaveBeenCalled();
  });

  it("rejects a cancelled purchase event without verification or finishing", async () => {
    const iap = fakeIap();
    let errorListener: ((error: unknown) => void) | undefined;
    (iap.purchaseErrorListener as ReturnType<typeof vi.fn>).mockImplementation((listener: (error: unknown) => void) => {
      errorListener = listener;
      return { remove: vi.fn() };
    });
    (iap.requestPurchase as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const verify = vi.fn();
    const billing = new NativeBillingService({
      iap,
      api: {
        getPlayConfig: vi.fn().mockResolvedValue({ enabled: true, productId: "doodle_credits_10", obfuscatedAccountId: binding }),
        verifyPlayPurchase: verify,
      },
    });

    await billing.prepare();
    expect(errorListener).toEqual(expect.any(Function));

    const purchase = billing.buy();
    errorListener!({ code: "E_USER_CANCELLED" });

    await expect(purchase).rejects.toMatchObject({ code: "purchase_rejected" });
    expect(verify).not.toHaveBeenCalled();
    expect(iap.finishTransaction).not.toHaveBeenCalled();
  });
});
