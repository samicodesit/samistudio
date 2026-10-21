// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useNativeDoodleApp } from "./use-native-doodle-app";
import type { NativeRuntime } from "./native-runtime";
import { NativeServiceError } from "../services/errors";
import { getNativeCopy, getNativeUsageLabel } from "../services/localization";
import { NativeIdeasCatalog } from "../services/ideas-catalog";

const device = vi.hoisted(() => ({ pick: vi.fn(), recover: vi.fn(), remove: vi.fn(), alert: vi.fn() }));
vi.mock("../../node_modules/react-native/index.js", () => ({ Alert: { alert: device.alert }, Platform: { OS: "ios" }, Linking: { openURL: vi.fn(async () => {}) }, AppState: { addEventListener: () => ({ remove() {} }) } }));
// The web renderer and native hook need one React dispatcher in this test.
vi.mock("../../node_modules/react/index.js", () => vi.importActual("../../../node_modules/react/index.js"));
vi.mock("./native-runtime", () => ({ createNativeRuntime: vi.fn() }));
vi.mock("./fixture-runtime", () => ({ createFrontendFixtureServices: vi.fn() }));
vi.mock("../platform/assets", () => ({ NATIVE_IDEA_ASSETS: [], NATIVE_REFERENCE_IMAGE: "reference.png" }));
vi.mock("../platform/localization", () => ({ getDeviceLocales: () => ["en"] }));
vi.mock("../platform/photo-picker", () => ({ pickPhoto: device.pick, recoverPhoto: device.recover, removePhotoFile: device.remove }));

afterEach(() => cleanup());
const selectedPhoto = { uri: "file:///private/prepared.jpg", base64: "cGhvdG8=" };
beforeEach(() => { device.pick.mockReset().mockResolvedValue(selectedPhoto); device.recover.mockReset().mockResolvedValue(null); device.remove.mockReset(); device.alert.mockReset(); });

it("replaces the guest count with a loading state until a delayed Google account balance is verified", async () => {
  const h = setup(); await ready(h);
  await act(async () => { h.result.current.onCreate(); });
  await waitFor(() => expect(h.result.current.usage.label).toBe("3 free doodles left"));
  let finish!: (account: { authenticated: boolean; email: string; balance: number; freeRemaining: number }) => void;
  h.runtime.api.getAccount = vi.fn(() => new Promise<Awaited<ReturnType<NativeRuntime["api"]["getAccount"]>>>(resolve => { finish = resolve; }));
  act(() => h.result.current.onSignIn());
  await waitFor(() => expect(h.runtime.api.getAccount).toHaveBeenCalled());
  expect(h.result.current.usage).toMatchObject({ status: "loading", label: "" });
  await act(async () => { finish({ authenticated: true, email: "reviewer@example.test", balance: 230, freeRemaining: 3 }); });
  await waitFor(() => expect(h.result.current.usage).toMatchObject({ status: "ready", label: "230 doodles left" }));
});

it.each(["apple", "google"] as const)("keeps pending %s sign-in attributed to that provider and clears it on cancellation", async provider => {
  const h = setup(true); await ready(h);
  await waitFor(() => expect(h.result.current.onAppleSignIn).toBeTypeOf("function"));
  let cancel!: (reason: unknown) => void;
  h.signIn.mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { cancel = reject; }));
  act(() => h.result.current.onOpenAccount());
  act(() => provider === "apple" ? h.result.current.onAppleSignIn?.() : h.result.current.onSignIn());
  expect(h.result.current.account.status).toBe("loading");
  expect(h.result.current.account.pendingProvider).toBe(provider);
  expect(h.result.current.accountModal).toBe("signIn");
  await act(async () => { cancel(new NativeServiceError("auth_cancelled")); });
  await waitFor(() => expect(h.result.current.account.status).toBe("signedOut"));
  expect(h.result.current.account.pendingProvider).toBeUndefined();
  expect(device.alert).not.toHaveBeenCalled();
});

it.each(["apple", "google"] as const)("dismisses successful %s sign-in before account refresh and purchase recovery finish", async provider => {
  const h = setup(true); await ready(h);
  await waitFor(() => expect(h.result.current.onAppleSignIn).toBeTypeOf("function"));
  const getAccount = h.runtime.api.getAccount.bind(h.runtime.api);
  let finishAccount!: () => void;
  let finishRecovery!: () => void;
  h.runtime.api.getAccount = vi.fn(() => new Promise<Awaited<ReturnType<typeof getAccount>>>(resolve => { finishAccount = () => { void getAccount().then(resolve); }; }));
  h.runtime.billing.recoverPacks = vi.fn(() => new Promise<void>(resolve => { finishRecovery = resolve; }));
  act(() => h.result.current.onOpenAccount());
  await act(async () => { provider === "apple" ? h.result.current.onAppleSignIn?.() : h.result.current.onSignIn(); });
  await waitFor(() => expect(h.runtime.api.getAccount).toHaveBeenCalled());
  expect(h.result.current.accountModal).toBe("closed");
  expect(h.result.current.account.status).toBe("loading");
  await act(async () => { finishAccount(); });
  await waitFor(() => expect(h.result.current.account.status).toBe("signedIn"));
  await waitFor(() => expect(h.runtime.billing.recoverPacks).toHaveBeenCalled());
  expect(h.result.current.accountModal).toBe("closed");
  await act(async () => { finishRecovery(); });
  expect(h.result.current.accountModal).toBe("closed");
});

function setup(appleAvailable = false, consented = true, ideas?: NativeIdeasCatalog, trialInitialized = true) {
  let token: string | null = null;
  let trialToken: string | null = trialInitialized ? "trial" : null;
  let free = 4;
  let paid = 0;
  let purchased = false;
  let grantListener: ((grant: any) => void) | undefined;
  let nextFailure = false;
  const account = () => ({ authenticated: !!token, email: token && token !== "apple" ? "buyer@example.test" : null, balance: paid, freeRemaining: trialToken ? free : null, hasPurchased: purchased });
  const packs = [
    { productId: "pack_mini", credits: 6, normalCredits: 6, offerApplied: false, price: 1.99, priceLabel: "€1.99", priceMicros: 1990000, currency: "EUR" },
    { productId: "pack_regular", credits: 25, normalCredits: 20, offerApplied: true, price: 4.99, priceLabel: "€4.99", priceMicros: 4990000, currency: "EUR" },
    { productId: "pack_big", credits: 60, normalCredits: 60, offerApplied: false, price: 9.99, priceLabel: "€9.99", priceMicros: 9990000, currency: "EUR" },
  ];
  const generate = vi.fn(async () => {
    if (nextFailure) { nextFailure = false; throw new NativeServiceError("timeout"); }
    trialToken ??= "trial";
    if (token && paid > 0) {
      return { imageUri: "result.png", paidRemaining: --paid };
    }
    if (!free) throw new NativeServiceError("payment_required");
    return { imageUri: "result.png", freeRemaining: --free };
  });
  const signIn = vi.fn(async (provider?: "google" | "apple") => { token = provider === "apple" ? "apple" : "signed-in"; });
  const buy = vi.fn(async (id: string) => {
    const pack = packs.find(p => p.productId === id)!;
    paid += pack.credits; purchased = true;
    return { status: "granted", productId: id, creditsGranted: pack.credits, offerApplied: pack.offerApplied, balance: paid };
  });
  const runtime = {
    config: { fixtureMode: false, apiBaseUrl: "https://doodle.samistudio.nl" },
    ideas,
    session: {
      hasDrawingConsent: async () => consented,
      setDrawingConsent: async () => { consented = true; },
      clearDrawingConsent: async () => { consented = false; },
      getAccessToken: async () => token, clearAccessToken: async () => { token = null; },
      getTrialToken: async () => trialToken, getLocale: async () => "en", getDetailLevel: async () => "simple", getPaperColor: async () => "yellow", setPaperColor: async () => undefined,
      getPurchaseHistoryHint: async () => purchased, setPurchaseHistoryHint: async () => {}, clearPurchaseHistoryHint: async () => {},
      setDetailLevel: async () => {}, setLocale: async () => {},
    },
    api: { getAccount: async () => account(), getTrialAccount: async () => ({ ...account(), authenticated: false }), generate, recordPaywall: vi.fn(async () => {}) },
    auth: { signIn, isAppleAvailable: async () => appleAvailable },
    billing: { subscribeGrants: (listener: (grant: any) => void) => { grantListener = listener; return () => { grantListener = undefined; }; }, preparePacks: async () => ({ packs, offerEnd: "2026-10-31T23:59:59+01:00" }), buyPack: buy, recoverPacks: async () => {}, dispose: async () => {} },
    media: { download: vi.fn(async () => {}), share: vi.fn(async () => {}) },
  } as unknown as NativeRuntime;
  const hook = renderHook(() => useNativeDoodleApp(runtime));
  return { ...hook, generate, signIn, buy, runtime, resolvePayment: () => { paid += 25; purchased = true; grantListener?.({ status: "granted", productId: "pack_regular", creditsGranted: 25, offerApplied: true, balance: paid }); }, failNext: () => { nextFailure = true; } };
}

it("explains a failed Apple account deletion and preserves the account for retry", async () => {
  const h = setup(true); await ready(h);
  await waitFor(() => expect(h.result.current.onAppleSignIn).toBeTypeOf("function"));
  act(() => h.result.current.onAppleSignIn?.());
  await waitFor(() => expect(h.result.current.account.status).toBe("signedIn"));
  act(() => h.result.current.onDeleteRequest());
  h.runtime.api.deleteAccount = async () => { throw new NativeServiceError("auth_unavailable"); };
  await act(async () => { await h.result.current.onDeleteConfirm(); });
  expect(h.result.current.account.status).toBe("signedIn");
  expect(h.result.current.accountModal).toBe("deleteConfirm");
  expect(device.alert).toHaveBeenCalledWith("Delete account", "Your account could not be deleted. Please try again.");
});

async function ready(h: ReturnType<typeof setup>) {
  await waitFor(() => expect(h.result.current.detailReady).toBe(true));
  await waitFor(() => expect(h.result.current.usage.label).toBe("4 free doodles left"));
  act(() => h.result.current.onSceneChange("A flower for my card"));
}

it("loads a server idea and uses its prompt without generating or consuming credits", async () => {
  const item = { id: "new-idea", image: "/ideas/astronaut-simple.webp", thumbnail: "/ideas/thumbs/astronaut-simple-640.webp", prompt: "An astronaut fishing for a star" };
  const catalog = new NativeIdeasCatalog({ baseUrl: "https://doodle.samistudio.nl", cache: { read: async () => null, write: async () => {} }, fetchImpl: async () => Response.json({ version: 1, locale: "en", items: [item] }) });
  const h = setup(false, true, catalog); await ready(h);
  await waitFor(() => expect(h.result.current.ideas[0]?.id).toBe("new-idea"));
  expect(h.result.current.ideas[0].previewImageUri).toBe("https://doodle.samistudio.nl/ideas/astronaut-simple.webp");
  act(() => h.result.current.onSelectIdea("new-idea"));
  expect(h.result.current.draft.scene).toBe("An astronaut fishing for a star");
  expect(h.generate).not.toHaveBeenCalled();
  expect(h.result.current.usage.label).toBe("4 free doodles left");
});

it("waits for the branded consent sheet to close before sending the drawing", async () => {
  const h = setup(false, false); await ready(h);
  act(() => h.result.current.onCreate());
  await waitFor(() => expect(h.result.current.drawingConsentVisible).toBe(true));
  expect(device.alert).not.toHaveBeenCalled();
  act(() => h.result.current.onDrawingConsentChoice?.("allow"));
  expect(h.result.current.drawingConsentVisible).toBe(false);
  expect(h.generate).not.toHaveBeenCalled();
  expect(await h.runtime.session.hasDrawingConsent()).toBe(false);
  // Closing content keeps the first choice, even if another button fires.
  act(() => h.result.current.onDrawingConsentChoice?.("cancel"));
  await act(async () => h.result.current.onDrawingConsentExit?.());
  await waitFor(() => expect(h.generate).toHaveBeenCalledTimes(1));
  expect(h.result.current.usage.label).toBe("3 free doodles left");
});

it("abandons a pending consent sheet when the app view unmounts", async () => {
  const h = setup(false, false); await ready(h);
  act(() => h.result.current.onCreate());
  await waitFor(() => expect(h.result.current.drawingConsentVisible).toBe(true));
  h.unmount();
  expect(h.generate).not.toHaveBeenCalled();
  expect(await h.runtime.session.hasDrawingConsent()).toBe(false);
});

it.each([false, true])("sends no content while consent is pending or cancelled (photo: %s)", async photo => {
  const h = setup(false, false); await ready(h);
  if (photo) await act(async () => { await h.result.current.onPickPhoto?.(); });
  act(() => { h.result.current.onCreate(); h.result.current.onCreate(); });
  await waitFor(() => expect(h.result.current.drawingConsentVisible).toBe(true));
  expect(device.alert).not.toHaveBeenCalled();
  expect(h.generate).not.toHaveBeenCalled();
  await chooseConsent(h, "cancel");
  expect(h.generate).not.toHaveBeenCalled();
  expect(h.result.current.generation.status).toBe("idle");
  expect(h.result.current.usage.label).toBe("4 free doodles left");
});

it("remembers an affirmative choice and asks again after consent is withdrawn", async () => {
  const h = setup(false, false); await ready(h);
  act(() => h.result.current.onCreate());
  await waitFor(() => expect(h.result.current.drawingConsentVisible).toBe(true));
  await chooseConsent(h, "allow");
  await waitFor(() => expect(h.generate).toHaveBeenCalledTimes(1));
  act(() => h.result.current.onCreate());
  await waitFor(() => expect(h.generate).toHaveBeenCalledTimes(2));
  expect(h.result.current.drawingConsentVisible).toBe(false);
  await act(async () => { await h.result.current.onWithdrawDrawingConsent?.(); });
  expect(await h.runtime.session.hasDrawingConsent()).toBe(false);
  device.alert.mockClear();
  act(() => h.result.current.onCreate());
  await waitFor(() => expect(h.result.current.drawingConsentVisible).toBe(true));
  expect(h.generate).toHaveBeenCalledTimes(2);
  await chooseConsent(h, "cancel");
});

it("does not send content when the privacy link is chosen or consent cannot be stored", async () => {
  const h = setup(false, false); await ready(h);
  act(() => h.result.current.onCreate());
  await waitFor(() => expect(h.result.current.drawingConsentVisible).toBe(true));
  await chooseConsent(h, "privacy");
  expect(h.generate).not.toHaveBeenCalled();
  h.runtime.session.setDrawingConsent = async () => { throw new Error("Storage unavailable"); };
  device.alert.mockClear();
  act(() => h.result.current.onCreate());
  await waitFor(() => expect(h.result.current.drawingConsentVisible).toBe(true));
  await chooseConsent(h, "allow");
  expect(h.generate).not.toHaveBeenCalled();
  expect(h.result.current.generation.status).toBe("error");
});
async function draw(h: ReturnType<typeof setup>, photo: boolean) {
  if (photo) await act(async () => { await h.result.current.onPickPhoto?.(); });
  else act(() => h.result.current.onRemovePhoto?.());
  act(() => h.result.current.onCreate());
  await waitFor(() => expect(h.result.current.generation.status).toBe("ready"));
  expect(h.generate).toHaveBeenLastCalledWith("A flower for my card", "simple", ...(photo ? [selectedPhoto.base64] : []));
}

it.each(["apple", "google"] as const)("allows the first free drawing after %s sign-in before a trial session exists", async provider => {
  const h = setup(true, true, undefined, false);
  await waitFor(() => expect(h.result.current.detailReady).toBe(true));
  await waitFor(() => expect(h.result.current.onAppleSignIn).toBeTypeOf("function"));
  act(() => provider === "apple" ? h.result.current.onAppleSignIn?.() : h.result.current.onSignIn());
  await waitFor(() => expect(h.result.current.account.status).toBe("signedIn"));
  act(() => h.result.current.onSceneChange("A flower for my card"));
  await draw(h, false);
  expect(h.result.current.usage.label).toBe("3 free doodles left");
  expect(h.result.current.purchase).toBeUndefined();
});

it("dismisses the share sheet without a success popup and preserves the drawing", async () => {
  const h = setup(); await ready(h); await draw(h, false);
  device.alert.mockClear();
  await act(async () => { h.result.current.onShare(); });
  expect(h.runtime.media.share).toHaveBeenCalledWith("result.png");
  expect(device.alert).not.toHaveBeenCalled();
  expect(h.result.current.generation).toMatchObject({ status: "ready", imageUri: "result.png" });
});

it("still explains a failure to open sharing", async () => {
  const h = setup(); await ready(h); await draw(h, false);
  vi.mocked(h.runtime.media.share).mockRejectedValueOnce(new NativeServiceError("media_unavailable"));
  await act(async () => { h.result.current.onShare(); });
  expect(device.alert).toHaveBeenCalledWith("Share doodle", getNativeCopy("en").errors.general);
});

it.each(["apple", "google"] as const)("keeps a partly used trial through %s sign-in without refilling it", async provider => {
  const h = setup(true); await ready(h);
  await draw(h, false); act(() => h.result.current.onResultBack());
  await draw(h, false); act(() => h.result.current.onResultBack());
  await waitFor(() => expect(h.result.current.onAppleSignIn).toBeTypeOf("function"));
  act(() => provider === "apple" ? h.result.current.onAppleSignIn?.() : h.result.current.onSignIn());
  await waitFor(() => expect(h.result.current.account.status).toBe("signedIn"));
  expect(h.result.current.usage.label).toBe("2 free doodles left");
  await draw(h, false);
  expect(h.result.current.usage.label).toBe("1 free doodle left");
  expect(h.result.current.purchase).toBeUndefined();
});

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

it("keeps the selected photo and Big pack while the iPhone user chooses Apple sign-in", async () => {
  const h = setup(true); await ready(h);
  await waitFor(() => expect(h.result.current.onAppleSignIn).toBeTypeOf("function"));
  await draw(h, true);
  const result = h.result.current.generation;
  act(() => h.result.current.onRefill());
  await waitFor(() => expect(h.result.current.purchase?.busy).toBe(false));
  act(() => h.result.current.onSelectPack?.("pack_big"));
  act(() => h.result.current.onPurchase());
  await waitFor(() => expect(h.result.current.purchase?.mode).toBe("signIn"));
  expect(h.signIn).not.toHaveBeenCalled();
  act(() => h.result.current.onAppleSignIn?.());
  await waitFor(() => expect(h.result.current.purchase).toBeUndefined());
  expect(h.signIn).toHaveBeenCalledWith("apple");
  expect(h.buy).toHaveBeenCalledWith("pack_big", 60);
  expect(h.result.current.account.status).toBe("signedIn");
  expect(h.result.current.account.email).toBeUndefined();
  expect(h.result.current.account.initial).toBeUndefined();
  expect(h.result.current.photo).toEqual(selectedPhoto);
  expect(h.result.current.draft.scene).toBe("A flower for my card");
  expect(h.result.current.generation).toEqual(result);
});

it("keeps Google available in the same iPhone purchase choice without substituting Apple", async () => {
  const h = setup(true); await ready(h);
  await waitFor(() => expect(h.result.current.onAppleSignIn).toBeTypeOf("function"));
  act(() => h.result.current.onRefill());
  await waitFor(() => expect(h.result.current.purchase?.busy).toBe(false));
  act(() => h.result.current.onSelectPack?.("pack_mini"));
  act(() => h.result.current.onPurchase());
  await waitFor(() => expect(h.result.current.purchase?.mode).toBe("signIn"));
  act(() => h.result.current.onSignIn());
  await waitFor(() => expect(h.result.current.purchase).toBeUndefined());
  expect(h.signIn).toHaveBeenCalledWith("google");
  expect(h.buy).toHaveBeenCalledWith("pack_mini", 6);
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

it.each(["apple", "google"] as const)("signing in with %s before the first drawing preserves all four free drawings", async provider => {
  const h = setup(true); await ready(h);
  await waitFor(() => expect(h.result.current.onAppleSignIn).toBeTypeOf("function"));
  act(() => provider === "apple" ? h.result.current.onAppleSignIn?.() : h.result.current.onSignIn());
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

it.each(["result", "error"] as const)("discards an old account's generation %s after switching accounts", async outcome => {
  const h = setup(true); await ready(h);
  act(() => h.result.current.onSignIn());
  await waitFor(() => expect(h.result.current.account.status).toBe("signedIn"));
  let finish!: () => void;
  h.generate.mockImplementationOnce(() => new Promise((resolve, reject) => {
    finish = () => outcome === "result"
      ? resolve({ imageUri: "private-account-a.png", paidRemaining: 86 })
      : reject(new NativeServiceError("payment_required"));
  }));
  act(() => h.result.current.onCreate());
  await waitFor(() => expect(h.result.current.generation.status).toBe("waiting"));
  h.runtime.api.signOut = async () => { await h.runtime.session.clearAccessToken(); };
  h.runtime.auth.signOut = async () => { await h.runtime.session.clearAccessToken(); };
  act(() => h.result.current.onSignOut());
  await waitFor(() => expect(h.result.current.account.status).toBe("signedOut"));
  act(() => h.result.current.onAppleSignIn?.());
  await waitFor(() => expect(h.result.current.account.status).toBe("signedIn"));
  const usage = h.result.current.usage.label;
  await act(async () => { finish(); });
  expect(h.result.current.usage.label).toBe(usage);
  expect(h.result.current.generation.status).toBe("idle");
  expect(h.result.current.purchase).toBeUndefined();
  act(() => h.result.current.onRedraw());
  expect(h.generate).toHaveBeenCalledTimes(1);
});

it("does not send a guest's pending drawing after signing in during consent", async () => {
  const h = setup(true, false); await ready(h);
  act(() => h.result.current.onCreate());
  await waitFor(() => expect(h.result.current.drawingConsentVisible).toBe(true));
  act(() => h.result.current.onAppleSignIn?.());
  await waitFor(() => expect(h.result.current.account.status).toBe("signedIn"));
  await chooseConsent(h, "allow");
  expect(h.generate).not.toHaveBeenCalled();
  expect(h.result.current.generation.status).toBe("idle");
  act(() => h.result.current.onCreate());
  await waitFor(() => expect(h.generate).toHaveBeenCalledTimes(1));
});

async function chooseConsent(h: ReturnType<typeof setup>, choice: "allow" | "cancel" | "privacy") {
  act(() => h.result.current.onDrawingConsentChoice?.(choice));
  await act(async () => h.result.current.onDrawingConsentExit?.());
}

it("captures paper before consent and retains it for redraw and the next scene", async () => {
 const h=setup(false,false);await ready(h);
 act(()=>h.result.current.onPaperColorChange?.("mint"));
 act(()=>h.result.current.onCreate());await waitFor(()=>expect(h.result.current.drawingConsentVisible).toBe(true));
 await chooseConsent(h,"allow");await waitFor(()=>expect(h.result.current.generation.status).toBe("ready"));
 expect(h.generate).toHaveBeenLastCalledWith("A flower for my card","simple",undefined,"mint");
 act(()=>h.result.current.onRedraw());await waitFor(()=>expect(h.generate).toHaveBeenCalledTimes(2));
 expect(h.generate).toHaveBeenLastCalledWith("A flower for my card","simple",undefined,"mint");
 await waitFor(()=>expect(h.result.current.generation.status).toBe("ready"));
 act(()=>h.result.current.onNewScene());expect(h.result.current.paperColor).toBe("mint");
 await act(async()=>{h.result.current.onRetry();});
 expect(h.generate).toHaveBeenCalledTimes(2);
});

it("opens the guest account panel before authentication when Apple sign-in is unavailable", async () => {
 const h=setup(false);await ready(h);
 act(()=>h.result.current.onOpenAccount());
 expect(h.result.current.accountModal).toBe("signIn");
 expect(h.signIn).not.toHaveBeenCalled();
 expect(h.result.current.usage.label).toContain("4");
});
