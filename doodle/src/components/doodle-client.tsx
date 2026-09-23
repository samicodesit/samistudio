"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { track } from "@vercel/analytics";
import type { AccountSummary } from "@/app/api/account/route";
import { formatCount, localePath, SUPPORTED_LOCALES, type DoodleCopy, type Locale } from "@/lib/i18n";
import { DEFAULT_SUGGESTION_IDS, localizeSceneIdeas, pickSceneIdeas, type SceneIdeaId } from "@/lib/scenes/suggestions";
import { AccountMenu } from "./account-menu";
import { SceneComposer } from "./scene-composer";
import { DoodleStage } from "./doodle-stage";
import { PurchaseDialog } from "./purchase-dialog";
import { ResultActions } from "./result-actions";
import { ResultDialog } from "./result-dialog";
import { isPlayRuntime } from "@/lib/billing/play-client";

type GenerationState =
  | { status: "idle"; imageUrl: null; error: null }
  | { status: "generating"; imageUrl: null; error: null }
  | { status: "ready"; imageUrl: string; imageFile: File; error: null }
  | { status: "error"; imageUrl: null; error: string };
type PurchaseReturnFocus =
  | { kind: "element"; element: HTMLElement }
  | { kind: "create" };

interface DoodleClientProps {
  locale: Locale;
  copy: DoodleCopy;
  initialScene?: string;
  initialSuggestionIds?: readonly SceneIdeaId[];
  accountHost?: "web" | "app";
}

const IDLE_STATE: GenerationState = { status: "idle", imageUrl: null, error: null };
const INITIAL_ACCOUNT: AccountSummary = {
  authenticated: false,
  email: null,
  balance: 0,
  freeRemaining: 2,
};

type ReturnIntent = "auth" | "account" | "checkout";
type SavedReturn = { scene?: string; intent?: ReturnIntent; path?: string };
const DOODLE_HOME_PATHS = new Set(SUPPORTED_LOCALES.map(localePath));

function readSavedReturn(): SavedReturn | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem("doodle:return") ?? "null") as unknown;
    if (!saved || typeof saved !== "object") return null;
    const value = saved as Record<string, unknown>;
    return {
      scene: typeof value.scene === "string" ? value.scene : undefined,
      intent: value.intent === "auth" || value.intent === "account" || value.intent === "checkout" ? value.intent : undefined,
      path: typeof value.path === "string" ? value.path : undefined,
    };
  } catch {
    return null;
  }
}

function safeDoodleHomePath(path: string | undefined): string | null {
  if (!path) return null;
  const normalized = path.length > 1 ? path.replace(/\/+$/, "") || "/" : path;
  return DOODLE_HOME_PATHS.has(normalized) ? normalized : null;
}

function messageForStatus(status: number, copy: DoodleCopy["errors"]): string {
  if (status === 429) return copy.rateLimited;
  if (status === 401) return copy.unavailable;
  if (status === 422) return copy.refused;
  if (status === 504) return copy.timeout;
  return copy.general;
}

export function DoodleClient({ locale, copy, initialScene = "", initialSuggestionIds, accountHost = "web" }: DoodleClientProps) {
  const [scene, setScene] = useState(initialScene);
  const initialIds = initialSuggestionIds ?? DEFAULT_SUGGESTION_IDS;
  const [suggestionIds, setSuggestionIds] = useState<readonly SceneIdeaId[]>(initialIds);
  const [generation, setGeneration] = useState<GenerationState>(IDLE_STATE);
  const [account, setAccount] = useState<AccountSummary>(INITIAL_ACCOUNT);
  const [accountReady, setAccountReady] = useState(false);
  const [isPurchaseOpen, setIsPurchaseOpen] = useState(false);
  const [signInOnly, setSignInOnly] = useState(false);
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
  const uncertaintyRevision = useRef(0);
  const recentSuggestionIds = useRef<readonly SceneIdeaId[]>(initialIds);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const purchaseReturnFocus = useRef<PurchaseReturnFocus | null>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const accountPortalTarget = typeof document === "undefined"
    ? null
    : document.querySelector<HTMLElement>(`[data-account-host="${accountHost}"]`);
  const focusNextScene = useRef(false);
  const sceneInputRef = useCallback((node: HTMLTextAreaElement | null) => {
    if (node && focusNextScene.current) {
      node.focus();
      focusNextScene.current = false;
    }
  }, []);

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

  const refreshSuggestions = useCallback(() => {
    const next = pickSceneIdeas({ prompts: copy.suggestions.items, recentIds: recentSuggestionIds.current });
    const nextIds = next.map((idea) => idea.id);
    recentSuggestionIds.current = nextIds;
    setSuggestionIds(nextIds);
  }, [copy.suggestions.items]);

  const restoreCreateFocus = useCallback(() => {
    const target = purchaseReturnFocus.current;
    purchaseReturnFocus.current = null;
    const focusTarget = target?.kind === "create"
      ? createButtonRef.current
        ?? document.querySelector<HTMLElement>("#composer .composer-footer > button")
        ?? document.querySelector<HTMLElement>(`[data-account-host="${accountHost}"] .account-menu > summary`)
      : target?.kind === "element" && target.element.isConnected
        ? target.element
        : document.querySelector<HTMLElement>(`[data-account-host="${accountHost}"] .account-menu > summary`) ?? createButtonRef.current;
    focusTarget?.focus({ preventScroll: true });
  }, [accountHost]);

  const replaceAccount = useCallback((nextAccount: AccountSummary) => {
    identityRevision.current += 1;
    usageRevision.current += 1;
    setAccount(nextAccount);
    setAccountReady(true);
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
  useEffect(() => { isPlayRuntime(); }, []);

  useLayoutEffect(() => {
    if (generation.status !== "idle" && window.innerWidth < 900 && !workspaceRef.current?.closest("[hidden]")) {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [generation.status]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(location.search);
    const authReturn = params.get("auth");
    const checkoutReturn = params.get("checkout");
    const savedReturn = readSavedReturn();
    const restoredScene = savedReturn?.scene ?? null;
    const returnPath = safeDoodleHomePath(savedReturn?.path);

    if (authReturn && returnPath && returnPath !== location.pathname) {
      const target = new URL(location.href);
      target.pathname = returnPath;
      target.search = `?auth=${authReturn === "success" ? "success" : "error"}`;
      target.hash = "";
      location.replace(target.toString());
      return () => { active = false; };
    }

    void (async () => {
      const identity = identityRevision.current;
      const usage = usageRevision.current;
      let returnedAccount: AccountSummary | null = null;
      try {
        const response = await fetch("/api/account", { cache: "no-store" });
        if (response.ok && active) {
          const nextAccount = (await response.json()) as AccountSummary;
          returnedAccount = nextAccount;
          setAccount((current) => ({
            authenticated: identityRevision.current === identity ? nextAccount.authenticated : current.authenticated,
            email: identityRevision.current === identity ? nextAccount.email : current.email,
            balance: usageRevision.current === usage ? nextAccount.balance : current.balance,
            freeRemaining: usageRevision.current === usage ? nextAccount.freeRemaining : current.freeRemaining,
          }));
        }
      } catch {}
      if (active) setAccountReady(true);
      if (!active) return;
      if (restoredScene !== null) setScene(restoredScene);

      if (authReturn) {
        sessionStorage.removeItem("doodle:return");
        removeQuery("auth");
        if (savedReturn?.intent === "account") {
          const signedIn = authReturn === "success" && returnedAccount?.authenticated;
          setSignInOnly(!signedIn);
          setPurchaseError(signedIn ? null : copy.auth.authError);
          setIsPurchaseOpen(!signedIn);
          return;
        }
        setSignInOnly(false);
        setPurchaseError(authReturn === "success" ? null : copy.auth.authError);
        setIsPurchaseOpen(true);
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

    if (document.activeElement instanceof HTMLTextAreaElement) {
      document.activeElement.blur();
    }
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
        purchaseReturnFocus.current = { kind: "create" };
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

      const imageBlob = await response.blob();
      const imageFile = new File([imageBlob], "doodle.png", { type: imageBlob.type || "image/png" });
      const imageUrl = URL.createObjectURL(imageBlob);
      currentObjectUrl.current = imageUrl;
      setGeneration({ status: "ready", imageUrl, imageFile, error: null });
      track("Doodle Created");
      if (response.headers.get("X-Doodle-Balance-Uncertain") === "1") {
        const identity = identityRevision.current;
        const usage = usageRevision.current;
        const uncertainty = ++uncertaintyRevision.current;
        void (async () => {
          try {
            const accountResponse = await fetch("/api/account", { cache: "no-store" });
            if (!accountResponse.ok) return;
            const nextAccount = (await accountResponse.json()) as AccountSummary;
            if (
              uncertaintyRevision.current === uncertainty
              && identityRevision.current === identity
              && usageRevision.current === usage
            ) {
              replaceAccount(nextAccount);
            }
          } catch {}
        })();
      }
    } catch {
      setGeneration({
        status: "error",
        imageUrl: null,
        error: copy.errors.general,
      });
    }
  }

  function handleNewScene() {
    focusNextScene.current = true;
    setScene("");
    setIsResultOpen(false);
    clearGeneration();
    refreshSuggestions();
  }

  function handleSuggestion(sceneSuggestion: string) {
    setScene(sceneSuggestion);
    setIsResultOpen(false);
    clearGeneration();
  }

  const suggestions = localizeSceneIdeas(suggestionIds, copy.suggestions.items);

  const inspectedImageUrl =
    generation.status === "ready" && generation.imageUrl
      ? generation.imageUrl
      : "/references/doodle-reference-kiss.png";
  const usage = accountReady
    ? account.authenticated
      ? formatCount(locale, copy.usage.paidLeft, account.balance)
      : account.freeRemaining !== null && account.freeRemaining < 2
        ? formatCount(locale, copy.usage.freeLeft, account.freeRemaining)
        : copy.usage.firstTwoFree
    : null;
  const accountMenu = accountReady ? account.authenticated ? (
    <AccountMenu account={account} locale={locale} copy={copy.account} onAccountChange={replaceAccount} purchaseLabel={copy.purchase.buy} onPurchase={(returnFocus) => {
      purchaseReturnFocus.current = returnFocus ? { kind: "element", element: returnFocus } : null;
      setSignInOnly(false);
      setPurchaseSuccess(false);
      setPurchaseError(null);
      setCheckoutRetry(null);
      setIsPurchaseOpen(true);
    }} />
  ) : (
    <button
      className="account-sign-in-action"
      type="button"
      onClick={(event) => {
        purchaseReturnFocus.current = { kind: "element", element: event.currentTarget };
        setSignInOnly(true);
        setPurchaseSuccess(false);
        setPurchaseError(null);
        setCheckoutRetry(null);
        setIsPurchaseOpen(true);
      }}
    >
      {copy.auth.signIn}
    </button>
  ) : undefined;
  const accountPortal = accountPortalTarget && accountMenu ? createPortal(accountMenu, accountPortalTarget) : null;

  function closePurchase() {
    setIsPurchaseOpen(false);
    setSignInOnly(false);
    setPurchaseSuccess(false);
    setPurchaseError(null);
  }

  return (
    <div ref={workspaceRef} className={`doodle-workspace doodle-workspace-${generation.status}`}>
      <div className="workspace-copy">
        {generation.status === "generating" ? null : generation.status === "ready" ? (
          <section className="state-copy" aria-labelledby="ready-title">
            <h1 id="ready-title">{copy.status.readyTitle}</h1>
            <ResultActions imageUrl={generation.imageUrl} imageFile={generation.imageFile} scene={scene} locale={locale} onTryAgain={createDoodle} onNewScene={handleNewScene} copy={copy.actions} />
            <div className="workspace-usage">
              {usage === null
                ? <span className="usage-loading" role="status" aria-label={copy.account.label} />
                : <span>{usage}</span>}
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
            usageLoadingLabel={copy.account.label}
            createButtonRef={createButtonRef}
            sceneInputRef={sceneInputRef}
          />
        )}
        {generation.status !== "generating" && generation.status !== "ready" ? (
        <section className="suggestions-section" aria-labelledby="suggestions-title">
          <div className="suggestions-heading">
            <h2 id="suggestions-title">{copy.suggestions.title}</h2>
          </div>
          <div className="suggestions-list">
            {suggestions.map((suggestion) => (
              <button key={suggestion.id} type="button" onClick={() => handleSuggestion(suggestion.prompt)}>
                <span>{suggestion.prompt}</span>
                <span className="suggestion-plus" aria-hidden="true">
                  +
                </span>
              </button>
            ))}
          </div>
        </section>
        ) : null}
      </div>
      {accountPortal}
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
          onExpressCheckoutComplete={confirmCheckout}
          onRestoreFocus={restoreCreateFocus}
          onClose={closePurchase}
          onAccountChange={replaceAccount}
          signInOnly={signInOnly}
        />
      ) : null}
    </div>
  );
}
