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
  const [isResultOpen, setIsResultOpen] = useState(false);
  const currentObjectUrl = useRef<string | null>(null);
  const handledCheckout = useRef<string | null>(null);
  const remainingRevision = useRef(0);
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

    function removeQuery(name: "auth" | "checkout") {
      const url = new URL(location.href);
      url.searchParams.delete(name);
      history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }

    void (async () => {
      const revision = remainingRevision.current;
      try {
        const response = await fetch("/api/account", { cache: "no-store" });
        if (response.ok && active) {
          const nextAccount = (await response.json()) as AccountSummary;
          setAccount((current) => remainingRevision.current === revision
            ? nextAccount
            : { ...nextAccount, balance: current.balance, freeRemaining: current.freeRemaining });
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
      handledCheckout.current = checkoutReturn;
      try {
        const response = await fetch("/api/checkout/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: checkoutReturn }),
        });
        if (!response.ok) throw new Error("confirmation failed");
        const body = (await response.json()) as { balance?: unknown };
        if (typeof body.balance !== "number" || !Number.isInteger(body.balance) || body.balance < 0) {
          throw new Error("invalid balance");
        }
        if (!active) return;
        setAccount((current) => ({ ...current, authenticated: true, balance: body.balance as number }));
        setPurchaseError(null);
        setPurchaseSuccess(true);
        setIsPurchaseOpen(true);
        sessionStorage.removeItem("doodle:return");
        removeQuery("checkout");
      } catch {
        if (!active) return;
        setPurchaseError(copy.purchase.checkoutError);
        setIsPurchaseOpen(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [copy.auth.authError, copy.purchase.checkoutError]);

  function updateRemaining(response: Response) {
    const paid = response.headers.get("X-Doodle-Paid-Remaining");
    const free = response.headers.get("X-Doodle-Free-Remaining");
    if (paid !== null && Number.isInteger(Number(paid)) && Number(paid) >= 0) {
      remainingRevision.current += 1;
      setAccount((current) => ({ ...current, balance: Number(paid) }));
    } else if (free !== null && Number.isInteger(Number(free)) && Number(free) >= 0) {
      remainingRevision.current += 1;
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
    <AccountMenu account={account} locale={locale} copy={copy.account} onAccountChange={setAccount} />
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
          onRestoreFocus={restoreCreateFocus}
          onClose={closePurchase}
          onAccountChange={setAccount}
        />
      ) : null}
    </div>
  );
}
