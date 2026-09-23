import { describe, expect, it } from "vitest";
import { appReducer, initialAppState } from "./native-app-state";

describe("native app state", () => {
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
});
