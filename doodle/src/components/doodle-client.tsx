"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AccountSummary } from "@/app/api/account/route";
import { formatCount, type DoodleCopy, type Locale } from "@/lib/i18n";
import { AccountMenu } from "./account-menu";
import { SceneComposer } from "./scene-composer";
import { DoodleStage } from "./doodle-stage";
import { PurchaseDialog } from "./purchase-dialog";
import { ResultActions } from "./result-actions";
import { ResultDialog } from "./result-dialog";

type GenerationState =
  | { status: "idle"; imageUrl: null; error: null }
  | { status: "generating"; imageUrl: null; error: null }
  | { status: "ready"; imageUrl: string; error: null }
  | { status: "error"; imageUrl: null; error: string };

interface DoodleClientProps {
  locale: Locale;
  copy: DoodleCopy;
}

const IDLE_STATE: GenerationState = { status: "idle", imageUrl: null, error: null };
const INITIAL_ACCOUNT: AccountSummary = {
  authenticated: false,
  email: null,
  balance: 0,
  freeRemaining: 2,
};

function messageForStatus(status: number, copy: DoodleCopy["errors"]): string {
  if (status === 429) return copy.rateLimited;
  if (status === 401) return copy.unavailable;
  if (status === 422) return copy.refused;
  if (status === 504) return copy.timeout;
  return copy.general;
}

export function DoodleClient({ locale, copy }: DoodleClientProps) {
  const [scene, setScene] = useState("");
  const [generation, setGeneration] = useState<GenerationState>(IDLE_STATE);
  const [account, setAccount] = useState<AccountSummary>(INITIAL_ACCOUNT);
  const [isPurchaseOpen, setIsPurchaseOpen] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [checkoutRetry, setCheckoutRetry] = useState<string | null>(null);
  const [checkoutConfirming, setCheckoutConfirming] = useState(false);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const currentObjectUrl = useRef<string | null>(null);
  const handledCheckout = useRef<string | null>(null);
  const pendingCheckout = useRef<string | null>(null);
  const identityRevision = useRef(0);
  const usageRevision = useRef(0);
  const createButtonRef = useRef<HTMLButtonElement>(null);

  const revokeCurrentUrl = useCallback(() => {
    if (currentObjectUrl.current) {
      URL.revokeObjectURL(currentObjectUrl.current);
      currentObjectUrl.current = null;
    }
  }, []);

  const clearGeneration = useCallback(() => {
    revokeCurrentUrl();
    setGeneration(IDLE_STATE);
  }, [revokeCurrentUrl]);

  const restoreCreateFocus = useCallback(() => createButtonRef.current?.focus(), []);

  const replaceAccount = useCallback((nextAccount: AccountSummary) => {
    identityRevision.current += 1;
    usageRevision.current += 1;
    setAccount(nextAccount);
  }, []);

  const removeQuery = useCallback((name: "auth" | "checkout") => {
    const url = new URL(location.href);
    url.searchParams.delete(name);
    history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const confirmCheckout = useCallback(async (sessionId: string) => {
    if (handledCheckout.current === sessionId || pendingCheckout.current === sessionId) return;
    pendingCheckout.current = sessionId;
    setCheckoutRetry(sessionId);
    setCheckoutConfirming(true);
    setPurchaseError(null);
    try {
      const response = await fetch("/api/checkout/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!response.ok) throw new Error("confirmation failed");
      const body = (await response.json()) as { balance?: unknown };
      if (typeof body.balance !== "number" || !Number.isInteger(body.balance) || body.balance < 0) {
        throw new Error("invalid balance");
      }
      identityRevision.current += 1;
      usageRevision.current += 1;
      setAccount((current) => ({ ...current, authenticated: true, balance: body.balance as number }));
      handledCheckout.current = sessionId;
      setCheckoutRetry(null);
      setPurchaseError(null);
      setPurchaseSuccess(true);
      setIsPurchaseOpen(true);
      sessionStorage.removeItem("doodle:return");
      removeQuery("checkout");
    } catch {
      setPurchaseError(copy.purchase.checkoutError);
      setIsPurchaseOpen(true);
    } finally {
      pendingCheckout.current = null;
      setCheckoutConfirming(false);
    }
  }, [copy.purchase.checkoutError, removeQuery]);

  useEffect(() => revokeCurrentUrl, [revokeCurrentUrl]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(location.search);
    const authReturn = params.get("auth");
    const checkoutReturn = params.get("checkout");
    let restoredScene: string | null = null;
    try {
      const saved = JSON.parse(sessionStorage.getItem("doodle:return") ?? "null") as unknown;
      if (saved && typeof saved === "object" && "scene" in saved && typeof saved.scene === "string") {
        restoredScene = saved.scene;
      }
    } catch {}

    void (async () => {
      const identity = identityRevision.current;
      const usage = usageRevision.current;
      try {
        const response = await fetch("/api/account", { cache: "no-store" });
        if (response.ok && active) {
          const nextAccount = (await response.json()) as AccountSummary;
          setAccount((current) => ({
            authenticated: identityRevision.current === identity ? nextAccount.authenticated : current.authenticated,
            email: identityRevision.current === identity ? nextAccount.email : current.email,
            balance: usageRevision.current === usage ? nextAccount.balance : current.balance,
            freeRemaining: usageRevision.current === usage ? nextAccount.freeRemaining : current.freeRemaining,
          }));
        }
      } catch {}
      if (!active) return;
      if (restoredScene !== null) setScene(restoredScene);

      if (authReturn) {
        setPurchaseError(authReturn === "success" ? null : copy.auth.authError);
        setIsPurchaseOpen(true);
        removeQuery("auth");
        return;
      }

      if (checkoutReturn === "cancelled") {
        removeQuery("checkout");
        return;
      }

      if (!checkoutReturn?.startsWith("cs_") || handledCheckout.current === checkoutReturn) return;
      await confirmCheckout(checkoutReturn);
    })();

    return () => {
      active = false;
    };
  }, [confirmCheckout, copy.auth.authError, removeQuery]);

  function updateRemaining(response: Response) {
    const paid = response.headers.get("X-Doodle-Paid-Remaining");
    const free = response.headers.get("X-Doodle-Free-Remaining");
    if (paid !== null && Number.isInteger(Number(paid)) && Number(paid) >= 0) {
      usageRevision.current += 1;
      setAccount((current) => ({ ...current, balance: Number(paid) }));
    } else if (free !== null && Number.isInteger(Number(free)) && Number(free) >= 0) {
      usageRevision.current += 1;
      setAccount((current) => ({ ...current, freeRemaining: Number(free) }));
    }
  }

  async function createDoodle() {
    if (!scene.trim() || generation.status === "generating") return;

    revokeCurrentUrl();
    setGeneration({ status: "generating", imageUrl: null, error: null });
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scene }),
      });

      updateRemaining(response);

      if (response.status === 402) {
        setGeneration(IDLE_STATE);
        setPurchaseError(null);
        setPurchaseSuccess(false);
        setIsPurchaseOpen(true);
        return;
      }

      if (!response.ok) {
        setGeneration({ status: "error", imageUrl: null, error: messageForStatus(response.status, copy.errors) });
        return;
      }

      const imageUrl = URL.createObjectURL(await response.blob());
      currentObjectUrl.current = imageUrl;
      setGeneration({ status: "ready", imageUrl, error: null });
    } catch {
      setGeneration({
        status: "error",
        imageUrl: null,
        error: copy.errors.general,
      });
    }
  }

  function handleNewScene() {
    setScene("");
    setIsResultOpen(false);
    clearGeneration();
  }

  function handleSuggestion(sceneSuggestion: string) {
    setScene(sceneSuggestion);
    setIsResultOpen(false);
    clearGeneration();
  }

  const inspectedImageUrl =
    generation.status === "ready" && generation.imageUrl
      ? generation.imageUrl
      : "/references/doodle-reference-kiss.png";
  const usage = account.authenticated
    ? formatCount(locale, copy.usage.paidLeft, account.balance)
    : account.freeRemaining !== null && account.freeRemaining < 2
      ? formatCount(locale, copy.usage.freeLeft, account.freeRemaining)
      : copy.usage.firstTwoFree;
  const accountMenu = account.authenticated ? (
    <AccountMenu account={account} locale={locale} copy={copy.account} onAccountChange={replaceAccount} />
  ) : undefined;

  function closePurchase() {
    setIsPurchaseOpen(false);
    setPurchaseSuccess(false);
    setPurchaseError(null);
  }

  return (
    <div className={`doodle-workspace doodle-workspace-${generation.status}`}>
      <div className="workspace-copy">
        {generation.status === "generating" ? (
          <section className="state-copy" aria-labelledby="generating-title">
            <p className="eyebrow">{copy.status.generatingEyebrow}</p>
            <h1 id="generating-title">{copy.status.generatingTitle}</h1>
            <p className="scene-summary">“{scene}”</p>
            <p className="wait-hint">{copy.status.waitHint}</p>
          </section>
        ) : generation.status === "ready" ? (
          <section className="state-copy" aria-labelledby="ready-title">
            <p className="eyebrow">{copy.status.readyEyebrow}</p>
            <h1 id="ready-title">{copy.status.readyTitle}</h1>
            <p className="scene-summary">“{scene}”</p>
            <ResultActions imageUrl={generation.imageUrl} onTryAgain={createDoodle} onNewScene={handleNewScene} copy={copy.actions} />
            <div className="workspace-usage">
              <span>{usage}</span>
              {accountMenu}
            </div>
          </section>
        ) : (
          <SceneComposer
            scene={scene}
            isGenerating={false}
            onSceneChange={setScene}
            onCreate={createDoodle}
            copy={copy.composer}
            usage={usage}
            accountMenu={accountMenu}
            createButtonRef={createButtonRef}
          />
        )}
        {generation.status !== "generating" && generation.status !== "ready" ? (
        <section className="suggestions-section" aria-labelledby="suggestions-title">
          <div className="suggestions-heading">
            <h2 id="suggestions-title">{copy.suggestions.title}</h2>
          </div>
          <div className="suggestions-list">
            {copy.suggestions.items.map((suggestion) => (
              <button key={suggestion} type="button" onClick={() => handleSuggestion(suggestion)}>
                <span>{suggestion}</span>
                <span className="suggestion-plus" aria-hidden="true">
                  +
                </span>
              </button>
            ))}
          </div>
        </section>
        ) : null}
      </div>
      <div className="workspace-visual">
        <DoodleStage
          key={generation.status}
          status={generation.status}
          imageUrl={generation.imageUrl}
          error={generation.error}
          onInspect={() => setIsResultOpen(true)}
          copy={copy.stage}
        />
      </div>
      {isResultOpen ? (
        <ResultDialog
          key={isResultOpen ? "open" : "closed"}
          imageUrl={inspectedImageUrl}
          open={isResultOpen}
          onClose={() => setIsResultOpen(false)}
          copy={copy.dialog}
        />
      ) : null}
      {isPurchaseOpen ? (
        <PurchaseDialog
          open
          account={account}
          scene={scene}
          locale={locale}
          copy={copy}
          success={purchaseSuccess}
          errorMessage={purchaseError}
          confirmationBusy={checkoutConfirming}
          onRetryConfirmation={checkoutRetry ? () => void confirmCheckout(checkoutRetry) : undefined}
          onRestoreFocus={restoreCreateFocus}
          onClose={closePurchase}
          onAccountChange={replaceAccount}
        />
      ) : null}
    </div>
  );
}
