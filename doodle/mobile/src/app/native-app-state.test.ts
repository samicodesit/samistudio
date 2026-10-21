import { describe, expect, it } from "vitest";
import { appReducer, initialAppState, resultUsage, isNativeCreditExhausted } from "./native-app-state";

describe("native app state", () => {
  it("waits for the restored session before displaying any credit count", () => {
    expect(initialAppState.usage).toEqual({ status: "loading", label: "" });
    expect(initialAppState.account.status).toBe("loading");
  });

  it("hides a previous guest count while the signed-in balance loads, then reveals the verified balance", () => {
    const guest = appReducer(initialAppState, { type: "accountLoaded", account: { authenticated: false, email: null, balance: 0, freeRemaining: 3 }, balanceLabel: "3 free doodles left" });
    const loading = appReducer(guest, { type: "accountLoading" });
    expect(loading.usage).toEqual({ status: "loading", label: "" });
    const verified = appReducer(loading, { type: "accountLoaded", account: { authenticated: true, email: "reviewer@example.test", balance: 230, freeRemaining: 3 }, balanceLabel: "230 doodles left" });
    expect(verified.usage).toEqual({ status: "ready", label: "230 doodles left" });
    const failed = appReducer(loading, { type: "accountError" });
    expect(failed.usage).toEqual({ status: "error", label: "" });
    expect(failed.account.status).toBe("error");
  });
  it("opens checkout only after the retained free and paid balances are exhausted", () => {
    expect(isNativeCreditExhausted(null, 0)).toBe(false);
    expect(isNativeCreditExhausted(3, 0)).toBe(false);
    expect(isNativeCreditExhausted(4, 0)).toBe(false);
    expect(isNativeCreditExhausted(0, 0)).toBe(true);
    expect(isNativeCreditExhausted(0, 6)).toBe(false);
    expect(isNativeCreditExhausted(0, null)).toBe(true);
    expect(isNativeCreditExhausted(1, null)).toBe(false);
    expect(isNativeCreditExhausted(null, null)).toBe(false);
  });
  it("replaces the last-free notice with the verified balance without losing the drawing or prompt", () => {
    const draft = appReducer(initialAppState, { type: "sceneChanged", scene: "A cat holding a flower" });
    const ready = appReducer(draft, { type: "generationReady", imageUri: "file:///fourth.png", imageAlt: "Cat", freeRemaining: 0 });
    expect(resultUsage(ready).lastFree).toBe(true);
    const refilled = appReducer(ready, { type: "usageChanged", label: "25 doodles left", paidRemaining: 25 });
    expect(resultUsage(refilled)).toMatchObject({ label: "25 doodles left", lastFree: false });
    expect(refilled.generation).toEqual(ready.generation);
    expect(refilled.scene).toBe(draft.scene);
    expect(resultUsage(appReducer(ready, { type: "usageChanged", label: "0 doodles left", paidRemaining: 0 })).lastFree).toBe(true);
  });
  it("keeps the account balance aligned with generation usage", () => {
    const signedIn = appReducer(initialAppState, {
      type: "accountLoaded",
      account: { authenticated: true, email: "sam@example.com", balance: 7, freeRemaining: null },
      balanceLabel: "7 doodles left",
    });
    const used = appReducer(signedIn, { type: "usageChanged", label: "6 doodles left", paidRemaining: 6 });

    expect(used.account.balanceLabel).toBe("6 doodles left");
    expect(used.usage.label).toBe("6 doodles left");
    expect(used.paidRemaining).toBe(6);
  });

  it("preserves the scene while waiting and on a generation error", () => {
    const withScene = appReducer(initialAppState, { type: "sceneChanged", scene: "Two cats hug" });
    const waiting = appReducer(withScene, { type: "generationStarted", loadingMessages: ["One", "Two"], statusLabel: "Drawing" });
    const failed = appReducer(waiting, { type: "generationFailed", message: "Try again" });

    expect(waiting.scene).toBe("Two cats hug");
    expect(waiting.generation.status).toBe("waiting");
    expect(failed.scene).toBe("Two cats hug");
    expect(failed.generation).toEqual({ status: "error", message: "Try again", retryLabel: "Try again" });
  });

  it("keeps the result until a new scene action and closes nested modals", () => {
    const ready = appReducer(initialAppState, { type: "generationReady", imageUri: "file:///doodle.png", imageAlt: "Doodle" });
    const more = appReducer(ready, { type: "modalChanged", modal: "more" });
    const cleared = appReducer(more, { type: "newScene" });

    expect(more.generation.status).toBe("ready");
    expect(cleared.generation).toEqual({ status: "idle" });
    expect(cleared.scene).toBe("");
    expect(cleared.modal).toBe("none");
  });

  it("returns from a result to the retained draft without changing usage", () => {
    const drafted = appReducer(initialAppState, { type: "sceneChanged", scene: "A mug beside a thank-you note" });
    const ready = appReducer(drafted, {
      type: "generationReady",
      imageUri: "file:///doodle.png",
      imageAlt: "Doodle",
      freeRemaining: 1,
      paidRemaining: 3,
    });
    const resultBack = appReducer(ready, { type: "resultBack" });

    expect(resultBack.generation).toEqual({ status: "idle" });
    expect(resultBack.scene).toBe(drafted.scene);
    expect(resultBack.sceneSource).toBe("result");
    expect(resultBack.revision).toBe(drafted.revision);
    expect(resultBack.freeRemaining).toBe(1);
    expect(resultBack.paidRemaining).toBe(3);
    expect(resultBack.modal).toBe("none");

    const edited = appReducer(resultBack, { type: "sceneChanged", scene: "A mug with a folded thank-you note" });
    expect(edited.sceneSource).toBe("result");
  });

  it("does not cancel a waiting generation when result back is dispatched", () => {
    const waiting = appReducer(initialAppState, { type: "generationStarted", loadingMessages: ["One"], statusLabel: "Drawing" });

    expect(appReducer(waiting, { type: "resultBack" })).toBe(waiting);
  });

  it("tracks account and purchase state without mixing it with generation", () => {
    const signedIn = appReducer(initialAppState, { type: "accountLoaded", account: { authenticated: true, email: "sam@example.com", balance: 4, freeRemaining: null } });
    const purchase = appReducer(signedIn, { type: "purchaseChanged", purchase: { mode: "offer" } });
    expect(purchase.account.status).toBe("signedIn");
    expect(purchase.account.email).toBe("sam@example.com");
    expect(purchase.purchase?.mode).toBe("offer");
  });
  it("keeps the fourth free result and prompt through purchase and dismissal", () => {
    const draft = appReducer(initialAppState, { type: "sceneChanged", scene: "A cat holding a flower" });
    const ready = appReducer(draft, { type: "generationReady", imageUri: "file:///fourth.png", imageAlt: "Cat", freeRemaining: 0 });
    expect(ready.modal).toBe("none");
    expect(ready.generation).toMatchObject({ status: "ready", freeExhausted: true });
    const offer = appReducer(ready, { type: "purchaseChanged", purchase: { mode: "offer" } });
    const closed = appReducer(offer, { type: "purchaseChanged", purchase: null });
    expect(closed.generation).toEqual(ready.generation);
    expect(closed.scene).toBe(draft.scene);
    const paid = appReducer(closed, { type: "generationReady", imageUri: "file:///paid.png", imageAlt: "Cat", paidRemaining: 0 });
    expect(paid.generation).not.toHaveProperty("freeExhausted");
  });

  it("clears paid usage when the account is signed out", () => {
    const signedIn = appReducer(initialAppState, {
      type: "accountLoaded",
      account: { authenticated: true, email: "sam@example.com", balance: 4, freeRemaining: null },
    });
    const signedOut = appReducer(signedIn, {
      type: "accountLoaded",
      account: { authenticated: false, email: null, balance: 0, freeRemaining: null },
    });

    expect(signedIn.paidRemaining).toBe(4);
    expect(signedOut.paidRemaining).toBeNull();
    expect(signedOut.freeRemaining).toBeNull();
  });

  it("keeps a retained account retryable after a transient refresh failure", () => {
    const signedIn = appReducer(initialAppState, {
      type: "accountLoaded",
      account: { authenticated: true, email: "sam@example.com", balance: 4, freeRemaining: null },
    });
    const retryable = appReducer(signedIn, { type: "accountError" });

    expect(retryable.account.status).toBe("error");
    expect(retryable.account.email).toBe("sam@example.com");
    expect(retryable.paidRemaining).toBe(4);
  });

  it("keeps an idea-selected draft identified while it is edited", () => {
    const selected = appReducer(initialAppState, { type: "ideaSelected", scene: "A bear reading to a rabbit" });
    const edited = appReducer(selected, { type: "sceneChanged", scene: "A bear reading a bedtime story to a rabbit" });
    const cleared = appReducer(edited, { type: "sceneChanged", scene: "" });
    const fresh = appReducer(cleared, { type: "newScene" });

    expect(selected.sceneSource).toBe("idea");
    expect(edited.sceneSource).toBe("idea");
    expect(cleared.sceneSource).toBe("idea");
    expect(fresh.sceneSource).toBe("empty");
  });

  it("keeps the active generation when an idea selection arrives while waiting", () => {
    const waiting = appReducer(initialAppState, { type: "generationStarted", loadingMessages: ["One"], statusLabel: "Drawing" });
    const attempted = appReducer(waiting, { type: "ideaSelected", scene: "A bear reading to a rabbit" });

    expect(attempted).toEqual(waiting);
  });

  it("keeps selected detail when switching ideas, scenes, tabs and locale", () => {
    let state = appReducer(initialAppState, { type: "detailLevelChanged", detailLevel: "detailed" });
    for (const action of [{ type: "ideaSelected", scene: "A cat" }, { type: "newScene" }, { type: "tabChanged", tab: "ideas" }, { type: "localeChanged", locale: "ar" }] as const) {
      state = appReducer(state, action);
      expect(state.detailLevel).toBe("detailed");
    }
  });

});

it("restores paper preference and retains it for a new scene", () => {
 const restored=appReducer(initialAppState,{type:"paperColorLoaded",paperColor:"pink"});
 expect(restored.paperColor).toBe("pink");expect(restored.paperReady).toBe(true);
 expect(appReducer(restored,{type:"newScene"}).paperColor).toBe("pink");
 const waiting={...restored,generation:{status:"waiting" as const,loadingMessageIndex:0,loadingMessages:[],statusLabel:"Drawing"}};
 expect(appReducer(waiting,{type:"paperColorChanged",paperColor:"blue"}).paperColor).toBe("pink");
});
