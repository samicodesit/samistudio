"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { track } from "@vercel/analytics";
import { ArrowLeft, RefreshCw } from "lucide-react";
import type { AccountSummary } from "@/app/api/account/route";
import { formatCount, localePath, SUPPORTED_LOCALES, type DoodleCopy, type Locale } from "@/lib/i18n";
import { DEFAULT_SUGGESTION_IDS, localizeSceneIdeas, pickSceneIdeas, type SceneIdeaId } from "@/lib/scenes/suggestions";
import { AccountMenu } from "./account-menu";
import { useDetailLevel } from "./use-detail-level";
import type { DetailLevel } from "@/lib/generation/detail-level";
import { SceneComposer } from "./scene-composer";
import { DoodleStage } from "./doodle-stage";
import { PurchaseDialog } from "./purchase-dialog";
import { ResultActions } from "./result-actions";
import { DoodlePreviewDialog } from "./doodle-preview-dialog";
import { AndroidAppLink } from "./discovery-links";
import { isPlayRuntime } from "@/lib/billing/play-client";
import { getLandingCopy, LANDING_EXAMPLE, type LandingCopy } from "@/lib/landing-copy";
import { getComposerIntro } from "@/lib/composer-intro";
import { usePhotoDraft } from "./use-photo-draft";
import { rememberPurchase } from "@/lib/purchase-wording";
import { getPackCopy, fillPackText } from "@/lib/pack-copy";
import { saveCheckoutDraft, readCheckoutDraft, discardCheckoutDraft } from "@/lib/checkout-draft-store";
import { getPhotoCopy, photoFailureMessage } from "@/lib/photo-copy";

type DoodleInput = { scene: string; detailLevel: DetailLevel; photo?: string };

type GenerationState =
  | { status: "idle"; imageUrl: null; error: null }
  | { status: "generating"; imageUrl: null; error: null }
  | { status: "ready"; imageUrl: string; imageFile: File; error: null; input: DoodleInput; lastFree?: boolean }
  | { status: "error"; imageUrl: null; error: string };
type PurchaseReturnFocus =
  | { kind: "element"; element: HTMLElement }
  | { kind: "create" };

interface DoodleClientProps {
  locale: Locale;
  copy: DoodleCopy;
  initialScene?: string;
  initialDetailLevel?: DetailLevel;
  initialSuggestionIds?: readonly SceneIdeaId[];
  accountHost?: "web" | "app";
  landing?: LandingCopy;
  webPacksEnabled?: boolean;
}

const IDLE_STATE: GenerationState = { status: "idle", imageUrl: null, error: null };
const INITIAL_ACCOUNT: AccountSummary = {
  authenticated: false,
  email: null,
  balance: 0,
  freeRemaining: null,
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

export function DoodleClient({ locale, copy, initialScene = "", initialDetailLevel, initialSuggestionIds, accountHost = "web", landing, webPacksEnabled = false }: DoodleClientProps) {
  const packCopy = getPackCopy(locale);
  const [purchaseNotice, setPurchaseNotice] = useState<string | null>(null);
  const composerHints = useMemo(() => getLandingCopy(locale).placeholderPrompts, [locale]);
  const [scene, setScene] = useState(initialScene);
  const { photo, preparing: preparingPhoto, error: photoError, input: photoInputRef, select: selectPhoto, remove: removePhoto, pick: pickPhoto } = usePhotoDraft(scene, setScene, getPhotoCopy(locale));
  const generationInFlight = useRef(false);
  const { detailLevel, detailReady, selectDetailLevel } = useDetailLevel(initialDetailLevel);
  const initialIds = initialSuggestionIds ?? DEFAULT_SUGGESTION_IDS;
  const [suggestionIds, setSuggestionIds] = useState<readonly SceneIdeaId[]>(initialIds);
  const [suggestionRefreshPhase, setSuggestionRefreshPhase] = useState<"idle" | "entering">("idle");
  const suggestionRefreshTimer = useRef<number | null>(null);
  const [generation, setGeneration] = useState<GenerationState>(IDLE_STATE);
  const [account, setAccount] = useState<AccountSummary>(INITIAL_ACCOUNT);
  const [accountReady, setAccountReady] = useState(false);
  const [isPurchaseOpen, setIsPurchaseOpen] = useState(false);
  const [signInOnly, setSignInOnly] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [checkoutPaymentPending, setCheckoutPaymentPending] = useState(false);
  const [checkoutRetry, setCheckoutRetry] = useState<string | null>(null);
  const [checkoutConfirming, setCheckoutConfirming] = useState(false);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [gridImageUrl, setGridImageUrl] = useState<string | null>(null);
  const currentObjectUrl = useRef<string | null>(null);
  const handledCheckout = useRef<string | null>(null);
  const pendingCheckout = useRef<string | null>(null);
  const purchaseDismissed = useRef(false);
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
  const focusNextCreate = useRef(false);
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

  useEffect(() => () => {
    if (suggestionRefreshTimer.current !== null) window.clearTimeout(suggestionRefreshTimer.current);
  }, []);

  const animateSuggestionRefresh = useCallback(() => {
    if (suggestionRefreshTimer.current !== null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      refreshSuggestions();
      return;
    }
    refreshSuggestions();
    setSuggestionRefreshPhase("entering");
    suggestionRefreshTimer.current = window.setTimeout(() => {
      suggestionRefreshTimer.current = null;
      setSuggestionRefreshPhase("idle");
    }, 320);
  }, [refreshSuggestions]);

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
    if(nextAccount.hasPurchased===true)rememberPurchase();
    if (!nextAccount.authenticated) {
      pendingCheckout.current = null;
      setCheckoutRetry(null); setCheckoutPaymentPending(false); setCheckoutConfirming(false);
      setPurchaseNotice(null);
      const url = new URL(location.href); url.searchParams.delete("checkout");
      history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
    setAccount(nextAccount);
    setAccountReady(true);
  }, []);

  const removeQuery = useCallback((name: "auth" | "checkout") => {
    const url = new URL(location.href);
    url.searchParams.delete(name);
    history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const confirmCheckout = useCallback(async (sessionId: string, showDialog = true) => {
    const identity = identityRevision.current;
    if (handledCheckout.current === sessionId || pendingCheckout.current === sessionId) return;
    if (showDialog) purchaseDismissed.current = false;
    pendingCheckout.current = sessionId;
    setCheckoutRetry(sessionId);
    setCheckoutConfirming(true);
    setCheckoutPaymentPending(true);
    setPurchaseError(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch("/api/checkout/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-doodle-packs": "v1" },
        body: JSON.stringify({ sessionId }),
        signal: controller.signal,
      });
      if (response.status === 202) throw new Error("checkout_pending");
      if (response.status === 409) throw new Error("checkout_failed");
      if (!response.ok) throw new Error("confirmation failed");
      const body = (await response.json()) as { balance?: unknown; creditsGranted?: unknown };
      if (typeof body.balance !== "number" || !Number.isInteger(body.balance) || body.balance < 0) {
        throw new Error("invalid balance");
      }
      if (identityRevision.current !== identity) return;
      identityRevision.current += 1;
      usageRevision.current += 1;
      setAccount((current) => ({ ...current, authenticated: true, balance: body.balance as number, hasPurchased: true }));
      rememberPurchase();
      handledCheckout.current = sessionId;
      setCheckoutRetry(null);
      setCheckoutPaymentPending(false);
      setPurchaseError(null);
      setIsPurchaseOpen(false);
      const creditsGranted = typeof body.creditsGranted === "number" && [6,10,20,25,60].includes(body.creditsGranted) ? body.creditsGranted : 10;
      setPurchaseNotice(fillPackText(getPackCopy(locale, creditsGranted).added, { count: creditsGranted }));
      sessionStorage.removeItem("doodle:return");
      removeQuery("checkout");
    } catch (error) {
      if (identityRevision.current !== identity) return;
      const paymentPending = error instanceof Error && error.message === "checkout_pending";
      const failed = error instanceof Error && error.message === "checkout_failed";
      if (failed) { setCheckoutPaymentPending(false); setCheckoutRetry(null); removeQuery("checkout"); }
      if (paymentPending) setCheckoutPaymentPending(true);
      setPurchaseError(failed ? copy.purchase.checkoutError : null);
      if (showDialog && !purchaseDismissed.current) setIsPurchaseOpen(true);
    } finally {
      clearTimeout(timeout);
      if (pendingCheckout.current === sessionId) { pendingCheckout.current = null; setCheckoutConfirming(false); }
    }
  }, [copy.purchase.checkoutError, removeQuery, locale]);

  useEffect(() => {
    if (!checkoutPaymentPending || !checkoutRetry) return;
    let checks = 0;
    const check = () => {
      if (document.visibilityState !== "visible" || checks >= 20) return;
      checks += 1;
      void confirmCheckout(checkoutRetry, false);
      if (checks === 20) clearInterval(timer);
    };
    let timer = setInterval(check, 15_000);
    const resume = () => { if (document.visibilityState === "visible") { clearInterval(timer); checks = 0; check(); timer = setInterval(check, 15_000); } };
    document.addEventListener("visibilitychange", resume);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", resume); };
  }, [checkoutPaymentPending, checkoutRetry, isPurchaseOpen, confirmCheckout]);

  useEffect(() => revokeCurrentUrl, [revokeCurrentUrl]);
  useEffect(() => { isPlayRuntime(); }, []);

  useLayoutEffect(() => {
    if (generation.status === "idle" && focusNextCreate.current) {
      createButtonRef.current?.focus();
      focusNextCreate.current = false;
    }
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
        const response = await fetch("/api/account", { cache: "no-store", headers: { "x-doodle-packs": "v1" } });
        if (response.ok && active) {
          const nextAccount = (await response.json()) as AccountSummary;
          returnedAccount = nextAccount;
          if(nextAccount.hasPurchased===true)rememberPurchase();
          setAccount((current) => ({
            authenticated: identityRevision.current === identity ? nextAccount.authenticated : current.authenticated,
            email: identityRevision.current === identity ? nextAccount.email : current.email,
            balance: usageRevision.current === usage ? nextAccount.balance : current.balance,
            freeRemaining: usageRevision.current === usage ? nextAccount.freeRemaining : current.freeRemaining,
            hasPurchased: identityRevision.current === identity ? nextAccount.hasPurchased : current.hasPurchased,
          }));
        }
      } catch {}
      if (active) setAccountReady(true);
      if (!active) return;
      if (restoredScene !== null) setScene(restoredScene);
      if (authReturn || checkoutReturn) {
        try {
          const draft=await readCheckoutDraft();
          if(draft && active){
            revokeCurrentUrl();
            const imageUrl=URL.createObjectURL(draft.image);currentObjectUrl.current=imageUrl;
            setGeneration({status:"ready",imageUrl,imageFile:new File([draft.image],"doodle.png",{type:draft.image.type||"image/png"}),error:null,input:{scene:draft.scene,detailLevel:draft.detailLevel,...(draft.photo?{photo:draft.photo}:{})},lastFree:draft.lastFree});
            setScene(draft.scene);
            discardCheckoutDraft();
          }
        }catch{}
      }

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
  }, [confirmCheckout, copy.auth.authError, removeQuery, revokeCurrentUrl]);

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

  function openPaywall(trigger: "tapped_create" | "get_more") {
    purchaseDismissed.current = false;
    purchaseReturnFocus.current = generation.status === "ready" && document.activeElement instanceof HTMLElement ? { kind:"element", element:document.activeElement } : { kind: "create" };
    setSignInOnly(false);
    setPurchaseError(null);
    setIsPurchaseOpen(true);
    void fetch("/api/checkout/paywall",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({trigger}),keepalive:true}).catch(()=>undefined);
  }

  async function preserveCheckoutDrawing() {
    if(generation.status==="ready")await saveCheckoutDraft({image:generation.imageFile,scene:generation.input.scene,detailLevel:generation.input.detailLevel,photo:generation.input.photo,lastFree:generation.lastFree===true});
  }

  async function createDoodle(input: DoodleInput = { scene, detailLevel, ...(photo ? { photo: photo.base64 } : {}) }) {
    if (!detailReady || preparingPhoto || (!input.photo && !input.scene.trim()) || generationInFlight.current) return;
    if (accountReady && account.balance === 0 && account.freeRemaining === 0) { openPaywall("tapped_create"); return; }
    const previousGeneration = generation;
    generationInFlight.current = true;

    if (document.activeElement instanceof HTMLTextAreaElement) {
      document.activeElement.blur();
    }
    setGeneration({ status: "generating", imageUrl: null, error: null });
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input.photo ? { photo: input.photo, detailLevel: input.detailLevel } : { scene: input.scene, detailLevel: input.detailLevel }),
      });

      updateRemaining(response);

      if (response.status === 402) {
        setGeneration(previousGeneration.status === "ready" ? previousGeneration : IDLE_STATE);
        openPaywall("tapped_create");
        return;
      }

      if (!response.ok) {
        const photoCode = response.status === 400 ? "invalid_photo" : response.status === 413 ? "request_too_large" : response.status === 422 ? "refused" : "";
        const photoMessage = input.photo ? photoFailureMessage(photoCode, getPhotoCopy(locale)) : undefined;
        setGeneration({ status: "error", imageUrl: null, error: photoMessage ?? messageForStatus(response.status, copy.errors) });
        return;
      }

      const imageBlob = await response.blob();
      const imageFile = new File([imageBlob], "doodle.png", { type: imageBlob.type || "image/png" });
      revokeCurrentUrl();
      discardCheckoutDraft();
      const imageUrl = URL.createObjectURL(imageBlob);
      currentObjectUrl.current = imageUrl;
      setGeneration({ status: "ready", imageUrl, imageFile, error: null, input, lastFree: response.headers.get("X-Doodle-Free-Remaining") === "0" });
      track("Doodle Created");
      if (response.headers.get("X-Doodle-Balance-Uncertain") === "1") {
        const identity = identityRevision.current;
        const usage = usageRevision.current;
        const uncertainty = ++uncertaintyRevision.current;
        void (async () => {
          try {
            const accountResponse = await fetch("/api/account", { cache: "no-store", headers: { "x-doodle-packs": "v1" } });
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
    } finally {
      generationInFlight.current = false;
    }
  }

  function handleResultBack() {
    focusNextScene.current = !photo;
    focusNextCreate.current = Boolean(photo);
    setIsResultOpen(false);
    clearGeneration();
  }

  function handleNewScene() {
    discardCheckoutDraft();
    setPurchaseNotice(null);
    removePhoto();
    focusNextScene.current = true;
    setScene("");
    setIsResultOpen(false);
    clearGeneration();
    refreshSuggestions();
  }

  function handleSuggestion(sceneSuggestion: string) {
    removePhoto();
    setScene(sceneSuggestion);
    setIsResultOpen(false);
    clearGeneration();
  }

  const suggestions = localizeSceneIdeas(suggestionIds, copy.suggestions.items);

  const inspectedImageUrl =
    generation.status === "ready" && generation.imageUrl
      ? generation.imageUrl
      : landing ? LANDING_EXAMPLE : "/references/doodle-reference-kiss.png";
  const usage = accountReady
    ? account.authenticated && (account.balance > 0 || account.freeRemaining === null)
      ? formatCount(locale, copy.usage.paidLeft, account.balance + (account.freeRemaining ?? 0))
      : account.freeRemaining !== null
        ? formatCount(locale, copy.usage.freeLeft, account.freeRemaining)
        : copy.usage.freeTrial
    : null;
  const accountMenu = accountReady ? account.authenticated ? (
    <AccountMenu account={account} locale={locale} copy={copy.account} onAccountChange={replaceAccount} purchaseLabel={packCopy.getMore} onPurchase={(returnFocus) => {
      purchaseDismissed.current = false;
      purchaseReturnFocus.current = returnFocus ? { kind: "element", element: returnFocus } : null;
      setSignInOnly(false);
      setPurchaseError(null);
      setIsPurchaseOpen(true);
    }} />
  ) : (
    <button
      className="account-sign-in-action"
      type="button"
      onClick={(event) => {
        purchaseReturnFocus.current = { kind: "element", element: event.currentTarget };
        setSignInOnly(true);
        setPurchaseError(null);
        setCheckoutRetry(null);
      setCheckoutPaymentPending(false);
        setIsPurchaseOpen(true);
      }}
    >
      {copy.auth.signIn}
    </button>
  ) : undefined;
  const accountPortal = accountPortalTarget && accountMenu ? createPortal(accountMenu, accountPortalTarget) : null;

  function closePurchase() {
    purchaseDismissed.current = true;
    setIsPurchaseOpen(false);
    setSignInOnly(false);
    setPurchaseError(null);
  }

  return (
    <div ref={workspaceRef} className={`doodle-workspace doodle-workspace-${generation.status}${landing ? " doodle-workspace-landing" : ""}`}>
      {purchaseNotice ? <p className="doodle-purchase-notice" role="status">{purchaseNotice}</p> : null}
      <input ref={photoInputRef} type="file" accept="image/*" hidden tabIndex={-1} aria-label={getPhotoCopy(locale).use} onChange={async event => { if (await selectPhoto(event.target.files?.[0])) clearGeneration(); }} />
      {generation.status === "ready" ? (
        <button type="button" className="result-back" onClick={handleResultBack}>
          <ArrowLeft size={20} aria-hidden="true" />
          <span>{copy.actions.back}</span>
        </button>
      ) : null}
      {landing && (generation.status === "idle" || generation.status === "error") ? (
        <div className="landing-intro">
          <h1>{landing.title}<br />{landing.titleEnd}</h1>
          <p>{landing.subtitle}</p>
        </div>
      ) : null}
      <div className="workspace-copy">
        {generation.status === "generating" ? null : generation.status === "ready" ? (
          <section className="state-copy" aria-labelledby="ready-title">
            <h1 id="ready-title">{copy.status.readyTitle}</h1>
            <ResultActions imageUrl={generation.imageUrl} imageFile={generation.imageFile} scene={generation.input.photo ? "Photo doodle" : generation.input.scene} locale={locale} onTryAgain={() => createDoodle(generation.input)} onNewScene={handleNewScene} copy={copy.actions} />
            {generation.lastFree && account.balance === 0 ? <div className="doodle-last-free"><span>{packCopy.lastFree}</span><button type="button" onClick={()=>openPaywall("get_more")}>{packCopy.getMore}</button></div> : null}
            <div className="workspace-usage">
              {usage === null
                ? <span className="usage-loading" role="status" aria-label={copy.account.label} />
                : <span>{usage}</span>}
            </div>
          </section>
        ) : (
          <SceneComposer
            photo={photo}
            preparingPhoto={preparingPhoto}
            photoError={photoError}
            onPickPhoto={pickPhoto}
            onRemovePhoto={() => { focusNextScene.current = true; removePhoto(); clearGeneration(); }}
            scene={scene}
            isGenerating={false}
            onSceneChange={setScene}
            onCreate={() => createDoodle()}
            locale={locale}
            detailLevel={detailLevel}
            detailReady={detailReady}
            onDetailLevelChange={selectDetailLevel}
            copy={{ ...copy.composer, ...getComposerIntro(locale), ...(landing ? { placeholder: landing.examplePrompt } : {}) }}
            usage={usage}
            usageLoadingLabel={copy.account.label}
            createButtonRef={createButtonRef}
            sceneInputRef={sceneInputRef}
            compactHeading={Boolean(landing)}
            placeholderPrompts={composerHints}
          />
        )}
        {!photo && generation.status !== "generating" && generation.status !== "ready" ? (
        <>
        {landing ? <section className="landing-suggestions" aria-label={landing.tryIdea}>
          <span>{landing.tryIdea}</span>
          {landing.suggestions.map(({ label, prompt }) => <button key={label} type="button" onClick={() => handleSuggestion(prompt)}>{label}</button>)}
        </section> : null}
        <section className="suggestions-section" aria-labelledby="suggestions-title">
          <div className="suggestions-heading">
            <h2 id="suggestions-title">{copy.suggestions.title}</h2>
            <button
              type="button"
              className="suggestions-refresh"
              aria-label={copy.suggestions.refresh}
              title={copy.suggestions.refresh}
              onClick={animateSuggestionRefresh}
              disabled={suggestionRefreshPhase !== "idle"}
              data-refreshing={suggestionRefreshPhase !== "idle"}
            >
              <RefreshCw size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="suggestions-list" data-refresh-phase={suggestionRefreshPhase} aria-busy={suggestionRefreshPhase !== "idle"}>
            {suggestions.map((suggestion) => (
              <button key={suggestion.id} type="button" disabled={suggestionRefreshPhase !== "idle"} onClick={() => handleSuggestion(suggestion.prompt)}>
                <span>{suggestion.prompt}</span>
                <span className="suggestion-plus" aria-hidden="true">
                  +
                </span>
              </button>
            ))}
          </div>
        </section>
        {landing ? <div className="landing-mobile-app-link"><AndroidAppLink locale={locale} /></div> : null}
        </>
        ) : null}
      </div>
      {accountPortal}
      <div className="workspace-visual">
        <div className="landing-stage-wrap">
        <DoodleStage
          key={generation.status}
          status={generation.status}
          imageUrl={generation.imageUrl}
          error={generation.error}
          onInspect={() => setIsResultOpen(true)}
          copy={copy.stage}
          locale={locale}
          gridEnabled={generation.imageUrl !== null && gridImageUrl === generation.imageUrl}
          onToggleGrid={() => setGridImageUrl(current => current === generation.imageUrl ? null : generation.imageUrl)}
          referenceImage={LANDING_EXAMPLE}
          referenceAlt={landing ? `${landing.exampleLabel}: ${landing.heroPrompt}` : undefined}
        />
        {landing && generation.status === "idle" ? <div className="landing-example-caption" id="examples">
          <span>{landing.exampleLabel}</span>
          <p>{landing.heroPrompt}</p>
        </div> : null}
        </div>
      </div>
      {isResultOpen ? (
        <DoodlePreviewDialog
          key={isResultOpen ? "open" : "closed"}
          imageUrl={inspectedImageUrl}
          open={isResultOpen}
          onClose={() => setIsResultOpen(false)}
          copy={copy.dialog}
          imageAlt={generation.status === "ready" ? copy.stage.generatedAlt : landing ? `${landing.exampleLabel}: ${landing.heroPrompt}` : copy.stage.referenceAlt}
          locale={locale}
          gridEnabled={generation.status === "ready" ? gridImageUrl === generation.imageUrl : undefined}
          onToggleGrid={generation.status === "ready" ? () => setGridImageUrl(current => current === generation.imageUrl ? null : generation.imageUrl) : undefined}
        />
      ) : null}
      {isPurchaseOpen ? (
        <PurchaseDialog
          open
          account={account}
          scene={scene}
          locale={locale}
          copy={copy}
          success={false}
          webPacksEnabled={webPacksEnabled}
          errorMessage={purchaseError}
          confirmationBusy={checkoutConfirming}
          paymentPending={checkoutPaymentPending}
          onRetryConfirmation={checkoutRetry ? () => void confirmCheckout(checkoutRetry) : undefined}
          onExpressCheckoutComplete={confirmCheckout}
          onBeforeCheckout={preserveCheckoutDrawing}
          onRestoreFocus={restoreCreateFocus}
          onClose={closePurchase}
          onAccountChange={replaceAccount}
          signInOnly={signInOnly}
        />
      ) : null}
    </div>
  );
}
