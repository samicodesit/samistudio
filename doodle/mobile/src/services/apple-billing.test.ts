import { expect, it, vi } from "vitest";
import { AppleBillingService } from "./apple-billing";
import type { PlayPack } from "../contracts/native";
const token = "11111111-1111-4111-8111-111111111111";
const packs: PlayPack[] = [
  { productId: "pack_mini", credits: 6, normalCredits: 6, offerApplied: false },
  { productId: "pack_regular", credits: 25, normalCredits: 20, offerApplied: true },
  { productId: "pack_big", credits: 60, normalCredits: 60, offerApplied: false },
];
const transaction = { id: "200000000000001", productId: "pack_mini", purchaseState: "purchased", appAccountToken: token };
function setup() {
  let updated = (_purchase: any) => {}; let failed = (_error: any) => {};
  const events: string[] = [];
  const iap = {
    initConnection: vi.fn(async () => true),
    fetchProducts: vi.fn(async () => packs.map(pack => ({ id: pack.productId, type: "in-app", displayPrice: "€2.99", price: 2.99, currency: "EUR" }))),
    purchaseUpdatedListener: (listener: typeof updated) => { events.push("listen"); updated = listener; return { remove() {} }; },
    purchaseErrorListener: (listener: typeof failed) => { failed = listener; return { remove() {} }; },
    requestPurchase: vi.fn(async () => { events.push("request"); updated(transaction); }),
    getPendingTransactionsIOS: vi.fn(async (): Promise<any[]> => []),
    getAvailablePurchases: vi.fn(async (): Promise<any[]> => []),
    finishTransaction: vi.fn(async () => { events.push("finish"); }),
    endConnection: vi.fn(async () => {}),
  };
  const grant = { status: "granted" as const, balance: 6, productId: "pack_mini", creditsGranted: 6, offerApplied: false, checkoutReference: token };
  const api = {
    getAppleCatalog: vi.fn(async () => ({ version: 1 as const, offerEnd: "2026-10-31T23:59:59+01:00", packs })),
    createAppleIntent: vi.fn(async () => ({ ...packs[0], appAccountToken: token })),
    verifyApplePurchase: vi.fn(async () => { events.push("verify"); return grant; }),
  };
  const billing = new AppleBillingService({ iap, api, purchaseTimeoutMs: 500 });
  return { iap, api, billing, grant, events, emit: (purchase: any) => updated(purchase), fail: (error: any) => failed(error) };
}
it("loads three localized prices and finishes only after durable delivery", async () => {
  const { billing, iap, events } = setup();
  expect((await billing.preparePacks()).packs).toHaveLength(3);
  expect(await billing.buyPack("pack_mini", 6)).toMatchObject({ status: "granted", balance: 6 });
  expect(events.indexOf("listen")).toBeLessThan(events.indexOf("request"));
  expect(events.indexOf("verify")).toBeLessThan(events.indexOf("finish"));
  expect(iap.requestPurchase).toHaveBeenCalledWith({ type: "in-app", request: { apple: { sku: "pack_mini", appAccountToken: token, andDangerouslyFinishTransactionAutomatically: false } } });
});
it("leaves an interrupted server delivery unfinished and recovers it after restart", async () => {
  const { billing, iap, api } = setup();
  api.verifyApplePurchase.mockRejectedValueOnce(Error("network interrupted"));
  await expect(billing.buyPack("pack_mini", 6)).rejects.toBeDefined();
  expect(iap.finishTransaction).not.toHaveBeenCalled();
  iap.getPendingTransactionsIOS.mockResolvedValue([transaction]);
  await billing.recoverPacks();
  expect(iap.finishTransaction).toHaveBeenCalledOnce();
});
it("does not finish rejected, foreign-account or malformed deliveries", async () => {
  const { billing, iap, api } = setup();
  await billing.preparePacks();
  iap.getPendingTransactionsIOS.mockResolvedValue([transaction]);
  api.verifyApplePurchase.mockRejectedValueOnce(Error("foreign account"));
  await billing.recoverPacks();
  expect(iap.finishTransaction).not.toHaveBeenCalled();
  api.verifyApplePurchase.mockResolvedValueOnce({ status: "granted", balance: -1 } as any);
  await billing.recoverPacks();
  expect(iap.finishTransaction).not.toHaveBeenCalled();
});
it("leaves pending approval unfinished and rejects a second checkout", async () => {
  const { billing, iap, emit } = setup();
  iap.requestPurchase.mockImplementationOnce(async () => { emit({ ...transaction, purchaseState: "pending" }); });
  await expect(billing.buyPack("pack_mini", 6)).rejects.toMatchObject({ code: "purchase_pending" });
  expect(iap.finishTransaction).not.toHaveBeenCalled();
  await expect(billing.buyPack("pack_mini", 6)).rejects.toMatchObject({ code: "purchase_pending" });
});
it("allows retry after cancellation without verifying or finishing", async () => {
  const { billing, iap, api, fail } = setup();
  iap.requestPurchase.mockImplementationOnce(async () => { fail({ code: "user-cancelled" }); });
  await expect(billing.buyPack("pack_mini", 6)).rejects.toMatchObject({ code: "purchase_rejected" });
  expect(api.verifyApplePurchase).not.toHaveBeenCalled();
  expect(iap.finishTransaction).not.toHaveBeenCalled();
  expect(await billing.buyPack("pack_mini", 6)).toMatchObject({ balance: 6 });
});
it("discards stale account callbacks before finishing or notifying", async () => {
  const { billing, iap, api } = setup();
  let release: (value: any) => void = () => {};
  api.verifyApplePurchase.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  const buying = billing.buyPack("pack_mini", 6);
  void buying.catch(() => {});
  await vi.waitFor(() => expect(api.verifyApplePurchase).toHaveBeenCalled());
  billing.resetAccount(); release({ status: "granted", balance: 6, productId: "pack_mini", creditsGranted: 6, offerApplied: false, checkoutReference: token });
  await expect(buying).rejects.toMatchObject({ code: "purchase_rejected" });
  expect(iap.finishTransaction).not.toHaveBeenCalled();
});
it("deduplicates concurrent callbacks and retries an unfinished confirmed transaction", async () => {
  const { billing, iap, emit } = setup();
  const notifications: any[] = []; billing.subscribeGrants(grant => notifications.push(grant));
  iap.finishTransaction.mockRejectedValueOnce(Error("interrupted finish"));
  iap.requestPurchase.mockImplementationOnce(async () => { emit(transaction); emit(transaction); });
  expect(await billing.buyPack("pack_mini", 6)).toMatchObject({ balance: 6 });
  iap.getPendingTransactionsIOS.mockResolvedValue([transaction]);
  await billing.recoverPacks();
  expect(notifications).toHaveLength(1);
  expect(iap.finishTransaction).toHaveBeenCalledTimes(2);
});
