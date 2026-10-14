// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useNativeDoodleApp } from "./use-native-doodle-app";
import type { NativeRuntime } from "./native-runtime";
import { NativeServiceError } from "../services/errors";
import { getNativeCopy, getNativeUsageLabel } from "../services/localization";

const device = vi.hoisted(() => ({ pick: vi.fn(), recover: vi.fn(), remove: vi.fn() }));
vi.mock("../../node_modules/react-native/index.js", () => ({ Alert: { alert: vi.fn() }, Linking: { openURL: vi.fn() }, AppState: { addEventListener: () => ({ remove() {} }) } }));
// The web renderer and native hook need one React dispatcher in this test.
vi.mock("../../node_modules/react/index.js", () => vi.importActual("../../../node_modules/react/index.js"));
vi.mock("./native-runtime", () => ({ createNativeRuntime: vi.fn() }));
vi.mock("./fixture-runtime", () => ({ createFrontendFixtureServices: vi.fn() }));
vi.mock("../platform/assets", () => ({ NATIVE_IDEA_ASSETS: [], NATIVE_REFERENCE_IMAGE: "reference.png" }));
vi.mock("../platform/localization", () => ({ getDeviceLocales: () => ["en"] }));
vi.mock("../platform/photo-picker", () => ({ pickPhoto: device.pick, recoverPhoto: device.recover, removePhotoFile: device.remove }));

afterEach(() => cleanup());
const selectedPhoto = { uri: "file:///private/prepared.jpg", base64: "cGhvdG8=" };
beforeEach(() => { device.pick.mockReset().mockResolvedValue(selectedPhoto); device.recover.mockReset().mockResolvedValue(null); device.remove.mockReset(); });

function setup() {
  let token: string | null = null;
  let free = 4;
  let paid = 0;
  let purchased = false;
  let grantListener: ((grant: any) => void) | undefined;
  let nextFailure = false;
  const account = () => ({ authenticated: !!token, email: token ? "buyer@example.test" : null, balance: paid, freeRemaining: free, hasPurchased: purchased });
  const packs = [
    { productId: "pack_mini", credits: 6, normalCredits: 6, offerApplied: false, price: 1.99, priceLabel: "€1.99", priceMicros: 1990000, currency: "EUR" },
    { productId: "pack_regular", credits: 25, normalCredits: 20, offerApplied: true, price: 4.99, priceLabel: "€4.99", priceMicros: 4990000, currency: "EUR" },
    { productId: "pack_big", credits: 60, normalCredits: 60, offerApplied: false, price: 9.99, priceLabel: "€9.99", priceMicros: 9990000, currency: "EUR" },
  ];
  const generate = vi.fn(async () => {
    if (nextFailure) { nextFailure = false; throw new NativeServiceError("timeout"); }
    if (token && paid > 0) {
      return { imageUri: "result.png", paidRemaining: --paid };
    }
    if (!free) throw new NativeServiceError("payment_required");
    return { imageUri: "result.png", freeRemaining: --free };
  });
  const signIn = vi.fn(async () => { token = "signed-in"; });
  const buy = vi.fn(async (id: string) => {
    const pack = packs.find(p => p.productId === id)!;
    paid += pack.credits; purchased = true;
    return { status: "granted", productId: id, creditsGranted: pack.credits, offerApplied: pack.offerApplied, balance: paid };
  });
  const runtime = {
    config: { fixtureMode: false },
    session: {
      getAccessToken: async () => token, clearAccessToken: async () => { token = null; },
      getTrialToken: async () => "trial", getLocale: async () => "en", getDetailLevel: async () => "simple",
      getPurchaseHistoryHint: async () => purchased, setPurchaseHistoryHint: async () => {}, clearPurchaseHistoryHint: async () => {},
      setDetailLevel: async () => {}, setLocale: async () => {},
    },
    api: { getAccount: async () => account(), getTrialAccount: async () => ({ ...account(), authenticated: false }), generate, recordPaywall: vi.fn(async () => {}) },
    auth: { signIn },
    billing: { subscribeGrants: (listener: (grant: any) => void) => { grantListener = listener; return () => { grantListener = undefined; }; }, preparePacks: async () => ({ packs, offerEnd: "2026-10-31T23:59:59+01:00" }), buyPack: buy, recoverPacks: async () => {}, dispose: async () => {} },
    media: { download: vi.fn(async () => {}), share: vi.fn(async () => {}) },
  } as unknown as NativeRuntime;
  const hook = renderHook(() => useNativeDoodleApp(runtime));
  return { ...hook, generate, signIn, buy, runtime, resolvePayment: () => { paid += 25; purchased = true; grantListener?.({ status: "granted", productId: "pack_regular", creditsGranted: 25, offerApplied: true, balance: paid }); }, failNext: () => { nextFailure = true; } };
}

async function ready(h: ReturnType<typeof setup>) {
  await waitFor(() => expect(h.result.current.detailReady).toBe(true));
  await waitFor(() => expect(h.result.current.usage.label).toBe("4 free doodles left"));
  act(() => h.result.current.onSceneChange("A flower for my card"));
}
async function draw(h: ReturnType<typeof setup>, photo: boolean) {
  if (photo) await act(async () => { await h.result.current.onPickPhoto?.(); });
  else act(() => h.result.current.onRemovePhoto?.());
  act(() => h.result.current.onCreate());
  await waitFor(() => expect(h.result.current.generation.status).toBe("ready"));
  expect(h.generate).toHaveBeenLastCalledWith("A flower for my card", "simple", ...(photo ? [selectedPhoto.base64] : []));
}

it.each(["en", "nl", "de", "fr", "es", "pt-br", "it", "ja", "ko", "ar"] as const)("gives %s scene-refusal guidance without losing the scene or allowance", async locale => {
  const h = setup(); await ready(h);
  act(() => h.result.current.onLocaleChange(locale));
  h.generate.mockRejectedValueOnce(new NativeServiceError("refused"));
  act(() => h.result.current.onCreate());
  await waitFor(() => expect(h.result.current.generation.status).toBe("error"));
  expect(h.result.current.generation).toMatchObject({ message: getNativeCopy(locale).errors.refused });
  expect(h.result.current.draft.scene).toBe("A flower for my card");
  expect(h.result.current.usage.label).toBe(getNativeUsageLabel(locale, 4, 0));
});

it("alternating text and photos exhausts one four-doodle allowance without an automatic paywall", async () => {
  const h = setup(); await ready(h);
  for (const [photo, remaining] of [[false, 3], [true, 2], [false, 1], [true, 0]] as const) {
    await draw(h, photo);
    expect(h.result.current.purchase).toBeUndefined();
    if (remaining) expect(h.result.current.usage.label).toBe(remaining === 1 ? "1 free doodle left" : `${remaining} free doodles left`);
    else expect(h.result.current.usage.lastFree).toBe(true);
    if (remaining) act(() => h.result.current.onResultBack());
  }
  const result = h.result.current.generation;
  act(() => h.result.current.onCreate());
  await waitFor(() => expect(h.result.current.purchase?.busy).toBe(false));
  expect(h.result.current.purchase?.body).toContain("Your 4 free doodles are used");
  expect(h.generate).toHaveBeenCalledTimes(4);
  expect(h.result.current.generation).toEqual(result);
  expect(h.result.current.photo).toEqual(selectedPhoto);
  expect(h.result.current.draft.scene).toBe("A flower for my card");
  expect(h.runtime.api.recordPaywall).toHaveBeenCalledWith("tapped_create");
});

it.each(["pack_mini", "pack_regular", "pack_big"] as const)("Buy keeps photo, prompt and result through sign-in and %s fulfillment", async id => {
  const h = setup(); await ready(h); await draw(h, true);
  const result = h.result.current.generation;
  act(() => h.result.current.onRefill());
  await waitFor(() => expect(h.result.current.purchase?.busy).toBe(false));
  act(() => h.result.current.onSelectPack?.(id));
  expect(h.signIn).not.toHaveBeenCalled();
  act(() => h.result.current.onCancelPurchase());
  expect(h.result.current.photo).toEqual(selectedPhoto);
  expect(h.result.current.generation).toEqual(result);
  act(() => h.result.current.onRefill());
  await waitFor(() => expect(h.result.current.purchase?.busy).toBe(false));
  expect(h.result.current.purchase?.selectedProductId).toBe(id);
  act(() => h.result.current.onPurchase());
  await waitFor(() => expect(h.result.current.purchase).toBeUndefined());
  expect(h.signIn).toHaveBeenCalledOnce();
  const count = id === "pack_mini" ? 6 : id === "pack_regular" ? 25 : 60;
  expect(h.buy).toHaveBeenCalledWith(id, count);
  expect(h.result.current.purchaseNotice).toBe(`Added ${count} doodles`);
  expect(h.result.current.photo).toEqual(selectedPhoto);
  expect(h.result.current.draft.scene).toBe("A flower for my card");
  expect(h.result.current.generation).toEqual(result);
  act(() => h.result.current.onResultBack());
  act(() => h.result.current.onCreate());
  await waitFor(() => expect(h.result.current.usage.label).toBe(`${count - 1} doodles left`));
  act(() => h.result.current.onResultBack());
  act(() => h.result.current.onRemovePhoto?.());
  act(() => h.result.current.onCreate());
  await waitFor(() => expect(h.result.current.usage.label).toBe(`${count - 2} doodles left`));
});

it("failed photo generation retains input and leaves the free allowance available to text", async () => {
  const h = setup(); await ready(h);
  await act(async () => { await h.result.current.onPickPhoto?.(); });
  h.failNext(); act(() => h.result.current.onCreate());
  await waitFor(() => expect(h.result.current.generation.status).toBe("error"));
  expect(h.result.current.photo).toEqual(selectedPhoto);
  expect(h.result.current.usage.label).toBe("4 free doodles left");
  await draw(h, false);
  expect(h.result.current.usage.label).toBe("3 free doodles left");
});

it.each(["auth", "billing"])("cancelled %s keeps the selected pack and photo draft usable", async boundary => {
  const h = setup(); await ready(h); await draw(h, true);
  act(() => h.result.current.onRefill());
  await waitFor(() => expect(h.result.current.purchase?.busy).toBe(false));
  act(() => h.result.current.onSelectPack?.("pack_big"));
  const failing = boundary === "auth" ? h.signIn : h.buy;
  failing.mockRejectedValueOnce(new NativeServiceError(boundary === "auth" ? "auth_cancelled" : "purchase_rejected"));
  act(() => h.result.current.onPurchase());
  await waitFor(() => expect(h.result.current.purchase?.mode).toBe("error"));
  act(() => h.result.current.onCancelPurchase());
  expect(h.result.current.purchase).toBeUndefined();
  expect(h.result.current.photo).toEqual(selectedPhoto);
  expect(h.result.current.draft.scene).toBe("A flower for my card");
  expect(h.result.current.generation.status).toBe("ready");
});

it("failed paid photo retains the paid balance for the next text drawing", async () => {
  const h = setup(); await ready(h);
  await act(async () => { await h.result.current.onPickPhoto?.(); });
  act(() => h.result.current.onRefill());
  await waitFor(() => expect(h.result.current.purchase?.busy).toBe(false));
  act(() => h.result.current.onPurchase());
  await waitFor(() => expect(h.result.current.purchase).toBeUndefined());
  h.failNext(); act(() => h.result.current.onCreate());
  await waitFor(() => expect(h.result.current.generation.status).toBe("error"));
  expect(h.result.current.usage.label).toBe("25 doodles left");
  expect(h.result.current.photo).toEqual(selectedPhoto);
  await draw(h, false);
  expect(h.result.current.usage.label).toBe("24 doodles left");
});

it("signing in before the first drawing preserves all four free drawings", async () => {
  const h = setup(); await ready(h);
  act(() => h.result.current.onSignIn());
  await waitFor(() => expect(h.result.current.account.status).toBe("signedIn"));
  expect(h.result.current.usage.label).toBe("4 free doodles left");
  for (const remaining of [3, 2, 1, 0]) {
    await draw(h, remaining % 2 === 0);
    expect(h.result.current.purchase).toBeUndefined();
    if (remaining) act(() => h.result.current.onResultBack());
  }
  expect(h.generate).toHaveBeenCalledTimes(4);
  expect(h.result.current.usage.lastFree).toBe(true);
  const result = h.result.current.generation;
  act(() => h.result.current.onCreate());
  await waitFor(() => expect(h.result.current.purchase?.busy).toBe(false));
  expect(h.generate).toHaveBeenCalledTimes(4);
  expect(h.result.current.generation).toEqual(result);
  expect(h.runtime.api.recordPaywall).toHaveBeenCalledOnce();
});

it("shows pending payment as a loading status while retaining the drawing and prompt", async () => {
 const h = setup(); await ready(h); await draw(h, true);
 const before = h.result.current.generation;
 h.buy.mockRejectedValueOnce(new NativeServiceError("purchase_pending"));
 act(() => h.result.current.onRefill());
 await waitFor(() => expect(h.result.current.purchase?.busy).toBe(false));
 act(() => h.result.current.onPurchase());
 await waitFor(() => expect(h.result.current.purchase?.mode).toBe("pending"));
 expect(h.result.current.purchase).toMatchObject({ busy: true, buyLabel: "Payment processing" });
 expect(h.result.current.purchase?.errorLabel).toBeUndefined();
 expect(h.result.current.generation).toEqual(before);
 expect(h.result.current.draft.scene).toBe("A flower for my card");
 act(() => h.result.current.onCancelPurchase());
 expect(h.result.current.purchase).toBeUndefined();
});

it("returns automatically from pending payment after a late authoritative grant", async () => {
 const h = setup(); await ready(h); await draw(h, true);
 const before = h.result.current.generation;
 h.buy.mockRejectedValueOnce(new NativeServiceError("purchase_pending"));
 act(() => h.result.current.onRefill());
 await waitFor(() => expect(h.result.current.purchase?.busy).toBe(false));
 act(() => h.result.current.onPurchase());
 await waitFor(() => expect(h.result.current.purchase?.mode).toBe("pending"));
 act(() => h.resolvePayment());
 await waitFor(() => expect(h.result.current.purchase).toBeUndefined());
 expect(h.result.current.purchaseNotice).toBe("Added 25 doodles");
 expect(h.result.current.usage.label).toBe("25 doodles left");
 expect(h.result.current.generation).toEqual(before);
 expect(h.result.current.draft.scene).toBe("A flower for my card");
});

it("keeps Buy disabled after dismissing and reopening an unresolved payment",async()=>{
 const h=setup();await ready(h);h.buy.mockRejectedValueOnce(new NativeServiceError("purchase_pending"));
 act(()=>h.result.current.onRefill());await waitFor(()=>expect(h.result.current.purchase?.busy).toBe(false));
 act(()=>h.result.current.onPurchase());await waitFor(()=>expect(h.result.current.purchase?.mode).toBe("pending"));
 act(()=>h.result.current.onCancelPurchase());act(()=>h.result.current.onRefill());
 await waitFor(()=>expect(h.result.current.purchase?.buyLabel).toBe("Payment processing"));
 act(()=>h.result.current.onPurchase());expect(h.buy).toHaveBeenCalledTimes(1);
 act(()=>h.resolvePayment());await waitFor(()=>expect(h.result.current.purchase).toBeUndefined());
 expect(h.result.current.purchaseNotice).toBe("Added 25 doodles");
});

it("loads pack prices when reopening a purchase recovered without an in-memory catalog", async () => {
 const h = setup(); await ready(h);
 h.runtime.billing.getPendingPack = () => "pack_mini";
 act(() => h.result.current.onSignIn());
 await waitFor(() => expect(h.result.current.account.status).toBe("signedIn"));
 await waitFor(() => expect(h.runtime.billing.getPendingPack?.()).toBe("pack_mini"));
 act(() => h.result.current.onRefill());
 await waitFor(() => expect(h.result.current.purchase?.packs).toHaveLength(3));
 expect(h.result.current.purchase).toMatchObject({ mode: "pending", busy: true, buyLabel: "Payment processing" });
 expect(h.result.current.purchase?.packs?.[0].selected).toBe(true);
 act(() => h.result.current.onPurchase());
 expect(h.buy).not.toHaveBeenCalled();
});

it("keeps recovery ownership when a catalog request finishes after discovering a pending order", async () => {
 const h = setup(); await ready(h);
 const catalog = await h.runtime.billing.preparePacks();
 let finish!: (value: typeof catalog) => void;
 h.runtime.billing.preparePacks = vi.fn(() => new Promise<typeof catalog>(resolve => { finish = resolve; }));
 h.runtime.billing.getPendingPack = () => "pack_regular";
 h.runtime.billing.recoverPacks = vi.fn(async () => {});
 act(() => h.result.current.onRefill());
 await waitFor(() => expect(h.runtime.billing.preparePacks).toHaveBeenCalled());
 act(() => h.result.current.onSignIn());
 await waitFor(() => expect(h.runtime.billing.recoverPacks).toHaveBeenCalled());
 await act(async () => { finish(catalog); });
 await waitFor(() => expect(h.result.current.purchase?.mode).toBe("pending"));
 expect(h.result.current.purchase).toMatchObject({ busy: true, buyLabel: "Payment processing" });
 act(() => h.result.current.onPurchase());
 expect(h.buy).not.toHaveBeenCalled();
 act(() => h.resolvePayment());
 await waitFor(() => expect(h.result.current.purchase).toBeUndefined());
 expect(h.result.current.purchaseNotice).toBe("Added 25 doodles");
});

it("releases the pending CTA when store recovery confirms no unfinished purchase",async()=>{
 const h=setup();await ready(h);h.buy.mockRejectedValueOnce(new NativeServiceError("purchase_pending"));
 act(()=>h.result.current.onRefill());await waitFor(()=>expect(h.result.current.purchase?.busy).toBe(false));act(()=>h.result.current.onPurchase());await waitFor(()=>expect(h.result.current.purchase?.mode).toBe("pending"));
 h.runtime.billing.getPendingPack=()=>null;
 act(()=>h.result.current.onCancelPurchase());act(()=>h.result.current.onRefill());
 await waitFor(()=>expect(h.result.current.purchase?.busy).toBe(false));expect(h.result.current.purchase?.mode).toBe("offer");
});

it.each(["signOut","delete"])("ignores old-account recovery finishing after %s",async boundary=>{
 const h=setup();await ready(h);let finish:()=>void=()=>{};
 h.runtime.billing.recoverPacks=vi.fn(()=>new Promise<void>(resolve=>{finish=resolve;}));h.runtime.billing.getPendingPack=()=>"pack_regular";
 h.runtime.api.signOut=async()=>{await h.runtime.session.clearAccessToken();};h.runtime.auth.signOut=async()=>{await h.runtime.session.clearAccessToken();};h.runtime.api.deleteAccount=async()=>{await h.runtime.session.clearAccessToken();};
 act(()=>h.result.current.onSignIn());await waitFor(()=>expect(h.runtime.billing.recoverPacks).toHaveBeenCalled());
 if(boundary==="signOut")act(()=>h.result.current.onSignOut());else await act(async()=>{await h.result.current.onDeleteConfirm();});
 await waitFor(()=>expect(h.result.current.account.status).toBe("signedOut"));await act(async()=>{finish();});
 act(()=>h.result.current.onRefill());await waitFor(()=>expect(h.result.current.purchase?.busy).toBe(false));expect(h.result.current.purchase?.mode).toBe("offer");
});

it("account deletion clears a purchase hint even when its earlier write finishes late",async()=>{
 const h=setup();await ready(h);act(()=>h.result.current.onSignIn());await waitFor(()=>expect(h.result.current.account.status).toBe("signedIn"));
 let persisted=false;let finish:()=>void=()=>{};
 h.runtime.session.setPurchaseHistoryHint=vi.fn(()=>new Promise<void>(resolve=>{finish=()=>{persisted=true;resolve();};}));
 h.runtime.session.clearPurchaseHistoryHint=vi.fn(async()=>{persisted=false;});h.runtime.api.deleteAccount=vi.fn(async()=>{await h.runtime.session.clearAccessToken();});
 act(()=>h.resolvePayment());await waitFor(()=>expect(h.runtime.session.setPurchaseHistoryHint).toHaveBeenCalled());
 act(()=>{void h.result.current.onDeleteConfirm();});await waitFor(()=>expect(h.runtime.api.deleteAccount).toHaveBeenCalled());
 await act(async()=>{finish();});await waitFor(()=>expect(h.result.current.account.status).toBe("signedOut"));expect(persisted).toBe(false);
});
