import { describe, expect, it, vi } from "vitest";
import type { NativePlayConfig, NativePlayVerifyResponse } from "../contracts/native";
import { NativeApiClient } from "./api-client";
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
  it.each(["granted", "already_granted"] as const)("accepts a server-consumed receipt (%s) without consuming it again", async (status) => {
    const iap = fakeIap();
    (iap.finishTransaction as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("ITEM_NOT_OWNED"));
    const billing = new NativeBillingService({
      iap,
      api: {
        getPlayConfig: vi.fn().mockResolvedValue({ enabled: true, productId: "doodle_credits_10", obfuscatedAccountId: binding }),
        verifyPlayPurchase: vi.fn().mockResolvedValue({ status, balance: 16 }),
      },
    });

    await billing.prepare();
    await expect(billing.buy()).resolves.toBeUndefined();
    expect(iap.finishTransaction).not.toHaveBeenCalled();
  });

  it("registers listeners before requesting a bound consumable and completes after server verification", async () => {
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
    expect(iap.finishTransaction).not.toHaveBeenCalled();
  });

  it("refreshes the server binding when a prepared connection is reused", async () => {
    const iap = fakeIap();
    const firstBinding = "a".repeat(64);
    const currentBinding = "c".repeat(64);
    (iap.requestPurchase as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      const listener = (iap.purchaseUpdatedListener as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
      listener?.({
        id: "purchase-current-account",
        productId: "doodle_credits_10",
        purchaseState: "purchased",
        purchaseToken: "token-current-account",
        obfuscatedAccountIdAndroid: currentBinding,
      });
    });
    const verify = vi.fn().mockResolvedValue({ status: "granted", balance: 10 } satisfies NativePlayVerifyResponse);
    const api = {
      getPlayConfig: vi.fn()
        .mockResolvedValueOnce({ enabled: true, productId: "doodle_credits_10", obfuscatedAccountId: firstBinding } satisfies NativePlayConfig)
        .mockResolvedValueOnce({ enabled: true, productId: "doodle_credits_10", obfuscatedAccountId: currentBinding } satisfies NativePlayConfig),
      verifyPlayPurchase: verify,
    };
    const billing = new NativeBillingService({ iap, api });

    await billing.prepare();
    await billing.prepare();
    await expect(billing.buy()).resolves.toBeUndefined();

    expect(api.getPlayConfig).toHaveBeenCalledTimes(2);
    expect(verify).toHaveBeenCalledWith({ productId: "doodle_credits_10", purchaseToken: "token-current-account" });
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
    expect(iap.finishTransaction).not.toHaveBeenCalled();
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

  it("records bounded purchase failures without logging receipt data", async () => {
    const iap = fakeIap();
    const diagnostics = { record: vi.fn(), flush: vi.fn() };
    (iap.requestPurchase as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      const listener = (iap.purchaseUpdatedListener as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
      listener?.({ productId: "doodle_credits_10", purchaseState: "purchased", purchaseToken: "secret-receipt-token", obfuscatedAccountIdAndroid: "c".repeat(64) });
    });
    const billing = new NativeBillingService({
      iap,
      diagnostics,
      api: {
        getPlayConfig: vi.fn().mockResolvedValue({ enabled: true, productId: "doodle_credits_10", obfuscatedAccountId: binding }),
        verifyPlayPurchase: vi.fn(),
      },
    });
    await billing.prepare();
    await expect(billing.buy()).rejects.toMatchObject({ code: "purchase_rejected" });
    expect(diagnostics.record).toHaveBeenCalledWith(expect.objectContaining({ operation: "billing", stage: "billing_purchase", code: "purchase_rejected" }));
    expect(JSON.stringify(diagnostics.record.mock.calls)).not.toContain("secret-receipt-token");
  });

  it("does not duplicate a Play config API failure in the billing service", async () => {
    const iap = fakeIap();
    const diagnostics = { record: vi.fn(), flush: vi.fn() };
    const api = new NativeApiClient({
      baseUrl: "https://doodle.samistudio.nl",
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ error: "temporary_error" }), { status: 503, headers: { "Content-Type": "application/json" } })),
      diagnostics,
      requestId: () => "00000000-0000-4000-8000-000000000019",
    });
    const billing = new NativeBillingService({ iap, api, diagnostics });

    await expect(billing.prepare()).rejects.toMatchObject({ code: "network", status: 503 });
    expect(diagnostics.record).toHaveBeenCalledTimes(1);
    expect(diagnostics.record).toHaveBeenCalledWith(expect.objectContaining({ operation: "billing", stage: "http_response", code: "temporary_error", status: 503, requestId: "00000000-0000-4000-8000-000000000019" }));
  });

  it("does not duplicate a Play receipt API failure in the billing service", async () => {
    const iap = fakeIap();
    const diagnostics = { record: vi.fn(), flush: vi.fn() };
    const api = new NativeApiClient({
      baseUrl: "https://doodle.samistudio.nl",
      fetchImpl: vi.fn<typeof fetch>()
        .mockResolvedValueOnce(new Response(JSON.stringify({ enabled: true, productId: "doodle_credits_10", obfuscatedAccountId: binding }), { status: 200, headers: { "Content-Type": "application/json" } }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ error: "temporary_error" }), { status: 503, headers: { "Content-Type": "application/json" } })),
      diagnostics,
      requestId: () => "00000000-0000-4000-8000-000000000020",
    });
    const billing = new NativeBillingService({ iap, api, diagnostics });

    await billing.prepare();
    await expect(billing.buy()).rejects.toMatchObject({ code: "network", status: 503 });
    expect(diagnostics.record).toHaveBeenCalledTimes(1);
    expect(diagnostics.record).toHaveBeenCalledWith(expect.objectContaining({ operation: "billing", stage: "http_response", code: "temporary_error", status: 503, requestId: "00000000-0000-4000-8000-000000000020" }));
  });

  it("silently completes best-effort IAP cleanup failures", async () => {
    const iap = fakeIap();
    (iap.endConnection as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("cleanup details"));
    const diagnostics = { record: vi.fn(), flush: vi.fn() };
    const billing = new NativeBillingService({
      iap,
      diagnostics,
      api: {
        getPlayConfig: vi.fn().mockResolvedValue({ enabled: true, productId: "doodle_credits_10", obfuscatedAccountId: binding }),
        verifyPlayPurchase: vi.fn(),
      },
    });

    await expect(billing.dispose()).resolves.toBeUndefined();
    expect(diagnostics.record).not.toHaveBeenCalled();
    expect(JSON.stringify(diagnostics.record.mock.calls)).not.toContain("cleanup details");
  });
});

describe("Native multi-pack checkout",()=>{
 it("loads the three packs for guests using numeric Play prices",async()=>{
  const iap=fakeIap();
  vi.mocked(iap.fetchProducts).mockResolvedValue(["pack_mini","pack_regular","pack_big"].map((id,i)=>({id,type:"in-app",displayPrice:["?1.99","?4.99","?9.99"][i],price:[1.99,4.99,9.99][i],currency:"EUR"})));
  const catalog={version:1,offerEnd:"2026-10-31T23:59:59+01:00",packs:[{productId:"pack_mini",credits:6,normalCredits:6,offerApplied:false},{productId:"pack_regular",credits:25,normalCredits:20,offerApplied:true},{productId:"pack_big",credits:60,normalCredits:60,offerApplied:false}]} as const;
  const getPlayConfig=vi.fn();
  const billing=new NativeBillingService({iap,api:{getPlayConfig,verifyPlayPurchase:vi.fn(),getPlayCatalog:vi.fn().mockResolvedValue(catalog)}});
  const result=await billing.preparePacks();
  expect(result.packs.map(p=>[p.productId,p.credits,p.priceLabel,p.price])).toEqual([["pack_mini",6,"?1.99",1.99],["pack_regular",25,"?4.99",4.99],["pack_big",60,"?9.99",9.99]]);
  expect(getPlayConfig).not.toHaveBeenCalled();
  await billing.dispose();
 });
 it.each(["granted", "already_granted", "granted_consume_pending"] as const)("binds the selected pack and shows the authoritative %s grant without consuming again",async status=>{
  const iap=fakeIap();
  const reference="a".repeat(64);
  vi.mocked(iap.fetchProducts).mockResolvedValue([{id:"pack_regular",type:"in-app",displayPrice:"?4.49",price:4.49,currency:"GBP"}]);
  vi.mocked(iap.requestPurchase).mockImplementation(async(input)=>{
   const listener=vi.mocked(iap.purchaseUpdatedListener).mock.calls[0][0];
   expect("google" in input.request ? input.request.google : null).toEqual({skus:["pack_regular"],obfuscatedAccountId:binding,obfuscatedProfileId:reference});
   listener({productId:"pack_regular",purchaseState:"purchased",purchaseToken:"real-shaped-receipt",obfuscatedAccountIdAndroid:binding});
  });
  const pack={productId:"pack_regular",credits:25,normalCredits:20,offerApplied:true} as const;
  const api={getPlayConfig:vi.fn(),getPlayCatalog:vi.fn().mockResolvedValue({version:1,offerEnd:"2026-10-31T23:59:59+01:00",packs:[pack]}),createPlayIntent:vi.fn().mockResolvedValue({...pack,obfuscatedAccountId:binding,obfuscatedProfileId:reference}),verifyPlayPurchase:vi.fn().mockResolvedValue({status,balance:25,productId:"pack_regular",creditsGranted:25,offerApplied:true,checkoutReference:reference})};
  const billing=new NativeBillingService({iap,api,purchaseTimeoutMs:50});
  await expect(billing.buyPack("pack_regular",25)).resolves.toMatchObject({creditsGranted:25});
  expect(iap.finishTransaction).not.toHaveBeenCalled();
  await billing.dispose();
 });
 it("returns a verified matching grant after the checkout dialog outlasts its timeout", async () => {
  vi.useFakeTimers();
  const iap = fakeIap();
  const reference = "a".repeat(64);
  const pack = { productId: "pack_regular", credits: 25, normalCredits: 20, offerApplied: true } as const;
  vi.mocked(iap.fetchProducts).mockResolvedValue([{ id: "pack_regular", type: "in-app", displayPrice: "?4.99", price: 4.99, currency: "EUR" }]);
  const grant = { status: "granted", balance: 44, productId: "pack_regular", creditsGranted: 25, offerApplied: true, checkoutReference: reference } as const;
  const api = { getPlayConfig: vi.fn(), getPlayCatalog: vi.fn().mockResolvedValue({ version: 1, offerEnd: "2026-10-31T23:59:59+01:00", packs: [pack] }), createPlayIntent: vi.fn().mockResolvedValue({ ...pack, obfuscatedAccountId: binding, obfuscatedProfileId: reference }), verifyPlayPurchase: vi.fn().mockResolvedValue(grant) };
  vi.mocked(iap.requestPurchase).mockImplementation(async () => {
   await vi.advanceTimersByTimeAsync(121_000);
   vi.mocked(iap.purchaseUpdatedListener).mock.calls[0][0]({ productId: "pack_regular", purchaseState: "purchased", purchaseToken: "delayed-dialog-receipt", obfuscatedAccountIdAndroid: binding });
   await Promise.resolve();
   await Promise.resolve();
  });
  const billing = new NativeBillingService({ iap, api });
  try {
   await expect(billing.buyPack("pack_regular", 25)).resolves.toEqual(grant);
  } finally {
   await billing.dispose();
   vi.useRealTimers();
  }
 });
 it("refreshes the expired offer before opening Google checkout",async()=>{
  const iap=fakeIap();
  vi.mocked(iap.fetchProducts).mockResolvedValue([{id:"pack_regular",type:"in-app",displayPrice:"?4.99",price:4.99,currency:"EUR"}]);
  const api={getPlayConfig:vi.fn(),verifyPlayPurchase:vi.fn(),createPlayIntent:vi.fn(),getPlayCatalog:vi.fn().mockResolvedValue({version:1,offerEnd:"2026-10-31T23:59:59+01:00",packs:[{productId:"pack_regular",credits:20,normalCredits:20,offerApplied:false}]})};
  const billing=new NativeBillingService({iap,api});
  await expect(billing.buyPack("pack_regular",25)).rejects.toMatchObject({code:"offer_changed"});
  expect(iap.requestPurchase).not.toHaveBeenCalled();
  expect(api.createPlayIntent).not.toHaveBeenCalled();
  await billing.dispose();
 });
});

describe("pack callback isolation", () => {
 it.each([
   { productId: "pack_mini", profile: undefined },
   { productId: "pack_regular", profile: "c".repeat(64) },
   { productId: "pack_regular", profile: undefined },
 ])("does not let an unrelated pending callback cancel the active pack: %j", async stale => {
  const iap = fakeIap();
  const reference = "a".repeat(64);
  const pack = { productId: "pack_regular", credits: 25, normalCredits: 20, offerApplied: true } as const;
  vi.mocked(iap.fetchProducts).mockResolvedValue([{ id: "pack_regular", type: "in-app", displayPrice: "GBP4.49", price: 4.49, currency: "GBP" }]);
  vi.mocked(iap.requestPurchase).mockImplementation(async () => {
   const listener = vi.mocked(iap.purchaseUpdatedListener).mock.calls[0][0];
   listener({ id: "stale-pending", productId: stale.productId, purchaseState: "pending", purchaseToken: "stale-token", obfuscatedProfileIdAndroid: stale.profile } as any);
   await new Promise(resolve => setTimeout(resolve, 0));
   listener({ id: "current", productId: "pack_regular", purchaseState: "purchased", purchaseToken: "current-token", obfuscatedAccountIdAndroid: binding });
  });
  const api = {
   getPlayConfig: vi.fn(),
   getPlayCatalog: vi.fn().mockResolvedValue({ version: 1, offerEnd: "2026-10-31T23:59:59+01:00", packs: [pack] }),
   createPlayIntent: vi.fn().mockResolvedValue({ ...pack, obfuscatedAccountId: binding, obfuscatedProfileId: reference }),
   verifyPlayPurchase: vi.fn().mockResolvedValue({ status: "granted", balance: 25, productId: "pack_regular", creditsGranted: 25, offerApplied: true, checkoutReference: reference }),
  };
  const billing = new NativeBillingService({ iap, api });
  await expect(billing.buyPack("pack_regular", 25)).resolves.toMatchObject({ creditsGranted: 25 });
  expect(api.verifyPlayPurchase).toHaveBeenCalledWith({ productId: "pack_regular", purchaseToken: "current-token" });
  await billing.dispose();
 });
});

it("delivers a late verified purchase to recovery observers after the UI wait timed out", async () => {
 vi.useFakeTimers();
 const iap = fakeIap(), reference = "a".repeat(64);
 const pack = { productId: "pack_regular", credits: 25, normalCredits: 20, offerApplied: true } as const;
 vi.mocked(iap.fetchProducts).mockResolvedValue([{ id: "pack_regular", type: "in-app", displayPrice: "?4.99", price: 4.99, currency: "EUR" }]);
 const grant = { status: "granted", balance: 25, productId: "pack_regular", creditsGranted: 25, offerApplied: true, checkoutReference: reference } as const;
 const api = { getPlayConfig: vi.fn(), getPlayCatalog: vi.fn().mockResolvedValue({ version: 1, offerEnd: "2026-10-31T23:59:59+01:00", packs: [pack] }), createPlayIntent: vi.fn().mockResolvedValue({ ...pack, obfuscatedAccountId: binding, obfuscatedProfileId: reference }), verifyPlayPurchase: vi.fn().mockResolvedValue(grant) };
 vi.mocked(iap.requestPurchase).mockResolvedValue(undefined);
 const billing = new NativeBillingService({ iap, api });
 const observed = vi.fn();
 try {
  const unsubscribe = billing.subscribeGrants(observed);
  const buy = billing.buyPack("pack_regular", 25);
  const expectation = expect(buy).rejects.toMatchObject({ code: "purchase_pending" });
  await vi.advanceTimersByTimeAsync(121_000); await expectation;
  const callback = vi.mocked(iap.purchaseUpdatedListener).mock.calls[0][0];
  callback({ id: "delayed", productId: "pack_regular", purchaseState: "purchased", purchaseToken: "late-order-token", obfuscatedAccountIdAndroid: binding });
  await vi.advanceTimersByTimeAsync(0);
  expect(observed).toHaveBeenCalledExactlyOnceWith(grant);
  callback({ id: "delayed", productId: "pack_regular", purchaseState: "purchased", purchaseToken: "late-order-token", obfuscatedAccountIdAndroid: binding });
  await vi.advanceTimersByTimeAsync(0);
  expect(observed).toHaveBeenCalledTimes(1);
  unsubscribe();
 } finally { await billing.dispose(); vi.useRealTimers(); }
});

it("blocks a second checkout after timeout until the first receipt is resolved",async()=>{
 vi.useFakeTimers();const iap=fakeIap(),reference="a".repeat(64);
 const pack={productId:"pack_regular",credits:25,normalCredits:20,offerApplied:true} as const;
 vi.mocked(iap.fetchProducts).mockResolvedValue([{id:"pack_regular",type:"in-app",displayPrice:"EUR4.99",price:4.99,currency:"EUR"}]);
 vi.mocked(iap.requestPurchase).mockResolvedValue(undefined);
 const api={getPlayConfig:vi.fn(),getPlayCatalog:vi.fn().mockResolvedValue({version:1,packs:[pack]}),createPlayIntent:vi.fn().mockResolvedValue({...pack,obfuscatedAccountId:binding,obfuscatedProfileId:reference}),verifyPlayPurchase:vi.fn().mockResolvedValue({status:"granted",productId:"pack_regular",checkoutReference:reference,creditsGranted:25,balance:25})};
 const billing=new NativeBillingService({iap,api});
 try{
  const first=expect(billing.buyPack("pack_regular",25)).rejects.toMatchObject({code:"purchase_pending"});await vi.advanceTimersByTimeAsync(121_000);await first;
  const second=billing.buyPack("pack_regular",25);const blocked=expect(second).rejects.toMatchObject({code:"purchase_pending"});await vi.advanceTimersByTimeAsync(121_000);await blocked;
  expect(iap.requestPurchase).toHaveBeenCalledTimes(1);
  const listener=vi.mocked(iap.purchaseUpdatedListener).mock.calls[0][0];listener({id:"original",productId:"pack_regular",purchaseState:"purchased",purchaseToken:"original-token",obfuscatedAccountIdAndroid:binding});await vi.advanceTimersByTimeAsync(0);
  expect(api.verifyPlayPurchase).toHaveBeenCalledTimes(1);
 }finally{await billing.dispose();vi.useRealTimers();}
});

it("does not deliver an account's late verification after the billing account is reset",async()=>{
 const iap=fakeIap();let finish:(value:NativePlayVerifyResponse)=>void=()=>{};
 const api={getPlayConfig:vi.fn().mockResolvedValue({enabled:true,productId:"doodle_credits_10",obfuscatedAccountId:binding}),verifyPlayPurchase:vi.fn(()=>new Promise<NativePlayVerifyResponse>(resolve=>{finish=resolve;}))};
 const billing=new NativeBillingService({iap,api}),observed=vi.fn();billing.subscribeGrants(observed);await billing.prepare();
 vi.mocked(iap.purchaseUpdatedListener).mock.calls[0][0]({id:"old-account",productId:"doodle_credits_10",purchaseState:"purchased",purchaseToken:"old-account-token",obfuscatedAccountIdAndroid:binding});
 (billing as any).resetAccount?.();finish({status:"granted",balance:10,creditsGranted:10});await new Promise(resolve=>setTimeout(resolve,0));
 expect(observed).not.toHaveBeenCalled();await billing.dispose();
});

it("discovers an existing pending Play order before launching another checkout after restart",async()=>{
 const iap=fakeIap(),reference="a".repeat(64);const pack={productId:"pack_regular",credits:25,normalCredits:20,offerApplied:true} as const;
 vi.mocked(iap.fetchProducts).mockResolvedValue([{id:"pack_regular",type:"in-app",displayPrice:"EUR4.99",price:4.99,currency:"EUR"}]);
 vi.mocked(iap.getAvailablePurchases).mockResolvedValue([{id:"pending",productId:"pack_regular",purchaseState:"pending",purchaseToken:"pending-order-token",obfuscatedAccountIdAndroid:binding,obfuscatedProfileIdAndroid:"c".repeat(64)}]);
 const api={getPlayConfig:vi.fn(),getPlayCatalog:vi.fn().mockResolvedValue({version:1,packs:[pack]}),createPlayIntent:vi.fn().mockResolvedValue({...pack,obfuscatedAccountId:binding,obfuscatedProfileId:reference}),verifyPlayPurchase:vi.fn()};
 const billing=new NativeBillingService({iap,api,purchaseTimeoutMs:1});await expect(billing.buyPack("pack_regular",25)).rejects.toMatchObject({code:"purchase_pending"});expect(iap.requestPurchase).not.toHaveBeenCalled();expect(api.verifyPlayPurchase).not.toHaveBeenCalled();await billing.dispose();
});


it("keeps the checkout blocked when the verification API reports a pending payment", async () => {
 const iap = fakeIap(), reference = "a".repeat(64);
 const pack = { productId: "pack_regular", credits: 25, normalCredits: 20, offerApplied: true } as const;
 const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ error: "purchase_pending" }), { status: 409, headers: { "Content-Type": "application/json" } }));
 const client = new NativeApiClient({ baseUrl: "https://doodle.samistudio.nl", fetchImpl, getAccessToken: async () => "a".repeat(43) });
 vi.mocked(iap.fetchProducts).mockResolvedValue([{ id: "pack_regular", type: "in-app", displayPrice: "EUR4.99", price: 4.99, currency: "EUR" }]);
 vi.mocked(iap.requestPurchase).mockImplementation(async () => {
  vi.mocked(iap.purchaseUpdatedListener).mock.calls[0][0]({ id: "pending-api-order", productId: "pack_regular", purchaseState: "purchased", purchaseToken: "pending-api-token", obfuscatedAccountIdAndroid: binding, obfuscatedProfileIdAndroid: reference });
 });
 const api = { getPlayConfig: vi.fn(), getPlayCatalog: vi.fn().mockResolvedValue({ version: 1, packs: [pack] }), createPlayIntent: vi.fn().mockResolvedValue({ ...pack, obfuscatedAccountId: binding, obfuscatedProfileId: reference }), verifyPlayPurchase: client.verifyPlayPurchase.bind(client) };
 const billing = new NativeBillingService({ iap, api, purchaseTimeoutMs: 50 });
 try {
  await expect(billing.buyPack("pack_regular", 25)).rejects.toMatchObject({ code: "purchase_pending", status: 409 });
  expect(billing.getPendingPack()).toBe("pack_regular");
  await expect(billing.buyPack("pack_regular", 25)).rejects.toMatchObject({ code: "purchase_pending" });
  expect(iap.requestPurchase).toHaveBeenCalledTimes(1);
  expect(iap.finishTransaction).not.toHaveBeenCalled();
  expect(fetchImpl).toHaveBeenCalledTimes(1);
 } finally { await billing.dispose(); }
});
