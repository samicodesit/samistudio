import type { DetailLevel } from "../../../src/lib/generation/detail-level";
import { getPhotoCopy, photoFailureMessage } from "../../../src/lib/photo-copy";
import { pickPhoto, recoverPhoto, removePhotoFile, type NativePhotoDraft } from "../platform/photo-picker";
import { useCallback, useEffect, useEffectEvent, useMemo, useReducer, useRef, useState } from "react";
import { Alert, AppState, Linking } from "react-native";
import type { NativeDoodleUiProps, NativeLocale, NativeReportSubmission } from "../ui/types";
import { canSubmitScene, characterCountLabel } from "../ui/ui-logic";
import type { AccountSummary, NativePackCatalog, PlayPackId } from "../contracts/native";
import { serviceErrorCode } from "../services/errors";
import { getNativeCopy, getNativeIdeas, getNativeLoadingMessages, getNativeLocales, getNativeSupportLinks, getNativeUsageLabel, isNativeLocale, localeFromDevice, nativeDirection } from "../services/localization";
import { createFrontendFixtureServices } from "./fixture-runtime";
import { createNativeRuntime, type NativeRuntime } from "./native-runtime";
import { getDeviceLocales } from "../platform/localization";
import { NATIVE_IDEA_ASSETS, NATIVE_REFERENCE_IMAGE } from "../platform/assets";
import { appReducer, initialAppState, resultUsage, isNativeCreditExhausted } from "./native-app-state";
import { localizeNativeSuggestionPrompts, pickNativeSuggestionIds } from "./native-suggestions";
import type { SceneIdeaId } from "../../../src/lib/scenes/suggestions";
import { makePurchaseUi } from "./purchase-ui";
import { exhaustedPurchaseHistory, makePackPurchaseUi } from "./pack-purchase-ui";
import { fillPackText, getNativePackCopy } from "../services/pack-copy";

export function useNativeDoodleApp(providedRuntime?: NativeRuntime): NativeDoodleUiProps {
  const runtime = useState(() => {
    const resolved = providedRuntime ?? createNativeRuntime();
    if (resolved.config.fixtureMode) {
      const fixture = createFrontendFixtureServices(resolved.config.fixtureMode);
      return { ...resolved, ...fixture };
    }
    return resolved;
  })[0];
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const [reportState, setReportState] = useState<{ pending: boolean; error?: string }>({ pending: false });
  const reportInFlight = useRef(false);
  const generationInFlight = useRef(false);
  const [photo, setPhoto] = useState<NativePhotoDraft | null>(null);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoRef = useRef<NativePhotoDraft | null>(null);
  const pickerInFlight = useRef(false);
  const mounted = useRef(true);
  const photoSelectionVersion = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; removePhotoFile(photoRef.current); }; }, []);
  const recoveredPhotoFailed = useEffectEvent((error: unknown) => {
    const copy = getPhotoCopy(state.locale);
    setPhotoError(error instanceof Error && error.message === "tooLarge" ? copy.tooLarge : copy.invalid);
  });
  useEffect(() => {
    const version = photoSelectionVersion.current;
    let active = true;
    let claimed = false;
    void recoverPhoto(() => {
      if (!active || version !== photoSelectionVersion.current || pickerInFlight.current || generationInFlight.current) return false;
      claimed = true; pickerInFlight.current = true; setPreparingPhoto(true);
      return true;
    }).then(selected => {
      if (!selected) return;
      if (!active || version !== photoSelectionVersion.current) { removePhotoFile(selected); return; }
      removePhotoFile(photoRef.current); photoRef.current = selected; setPhoto(selected);
    }).catch(error => {
      if (active && claimed && version === photoSelectionVersion.current) recoveredPhotoFailed(error);
    }).finally(() => {
      if (claimed) { pickerInFlight.current = false; if (active) setPreparingPhoto(false); }
    });
    return () => { active = false; };
  }, []);
  const onRemovePhoto = useCallback(() => {
    photoSelectionVersion.current += 1;
    removePhotoFile(photoRef.current); photoRef.current = null; setPhoto(null); setPhotoError(null);
    dispatch({ type: "generationIdle" });
  }, []);
  const onPickPhoto = useCallback(async () => {
    if (pickerInFlight.current || generationInFlight.current) return;
    const version = ++photoSelectionVersion.current;
    pickerInFlight.current = true; setPreparingPhoto(true); setPhotoError(null);
    try {
      const selected = await pickPhoto();
      if (!mounted.current || version !== photoSelectionVersion.current) { removePhotoFile(selected); return; }
      if (selected) { removePhotoFile(photoRef.current); photoRef.current = selected; setPhoto(selected); dispatch({ type: "generationIdle" }); }
    } catch (error) {
      if (mounted.current && version === photoSelectionVersion.current) { const text = getPhotoCopy(state.locale); setPhotoError(error instanceof Error && error.message === "tooLarge" ? text.tooLarge : text.invalid); }
    } finally { pickerInFlight.current = false; if (mounted.current) setPreparingPhoto(false); }
  }, [state.locale]);
  const lastResultInput = useRef<{ scene: string; detailLevel: DetailLevel; photo?: string } | null>(null);
  const preferenceWrite = useRef<Promise<void>>(Promise.resolve());
  const accountSummary = useRef<AccountSummary | null>(null);
  const [hasPurchased, setHasPurchased] = useState<boolean | undefined>();
  const purchaseHistoryHint = useRef<boolean | undefined>(undefined);
  const purchaseHistoryWrites = useRef<Promise<void>>(Promise.resolve());
  const savePurchaseHistoryHint = useCallback(() => {
    const write = runtime.session.setPurchaseHistoryHint(true).catch(() => undefined);
    purchaseHistoryWrites.current = Promise.allSettled([purchaseHistoryWrites.current, write]).then(() => undefined);
    return write;
  }, [runtime]);
  const [packCatalog, setPackCatalog] = useState<NativePackCatalog | null>(null);
  const [selectedPack, setSelectedPack] = useState<PlayPackId>("pack_regular");
  const [purchaseNotice, setPurchaseNotice] = useState<string>();
  const checkoutInFlight = useRef(false);
  const accountRevision = useRef(0);
  const pendingProduct = useRef<PlayPackId | null>(null);
  const [paymentPending, setPaymentPending] = useState(false);
  const offerRequest = useRef(0);
  const packCopy = getNativePackCopy(state.locale);
  useEffect(() => {
    if (!purchaseNotice) return;
    const timer = setTimeout(() => setPurchaseNotice(undefined), 3500);
    return () => clearTimeout(timer);
  }, [purchaseNotice]);
  const baseCopy = useMemo(() => getNativeCopy(state.locale), [state.locale]);
  const [suggestionIds, setSuggestionIds] = useState<readonly SceneIdeaId[]>(() => pickNativeSuggestionIds(baseCopy.suggestions.items));
  const recentSuggestionIds = useRef<SceneIdeaId[]>([...suggestionIds]);
  const selectedSuggestions = useMemo(() => localizeNativeSuggestionPrompts(suggestionIds, baseCopy.suggestions.items), [baseCopy.suggestions.items, suggestionIds]);
  const copy = useMemo(() => ({
    ...baseCopy,
    suggestions: { ...baseCopy.suggestions, items: selectedSuggestions },
  }), [baseCopy, selectedSuggestions]);
  const ideas = useMemo(() => getNativeIdeas(state.locale, NATIVE_IDEA_ASSETS), [state.locale]);
  const locales = useMemo(() => getNativeLocales(), []);
  const supportLinks = useMemo(() => getNativeSupportLinks(state.locale), [state.locale]);

  const applyAccount = useCallback((account: AccountSummary, locale: NativeLocale) => {
    accountSummary.current = account;
    setHasPurchased(account.authenticated ? account.hasPurchased ?? undefined : purchaseHistoryHint.current);
    if (account.authenticated && account.hasPurchased === true) {
      purchaseHistoryHint.current = true;
      void savePurchaseHistoryHint();
    }
    const paid = account.authenticated ? account.balance : null;
    dispatch({ type: "accountLoaded", account, balanceLabel: getNativeUsageLabel(locale, account.freeRemaining, paid) });
    dispatch({ type: "usageChanged", label: getNativeUsageLabel(locale, account.freeRemaining, paid), freeRemaining: account.freeRemaining ?? undefined, paidRemaining: paid ?? undefined });
  }, [runtime, savePurchaseHistoryHint]);

  const refreshAccount = useCallback(async (locale: NativeLocale) => {
    const revision = accountRevision.current;
    const emptyGuest: AccountSummary = { authenticated: false, email: null, balance: 0, freeRemaining: null };
    const accessToken = await runtime.session.getAccessToken().catch(() => null);
    try {
      let account = await runtime.api.getAccount();
      if (accessToken && !account.authenticated) await runtime.session.clearAccessToken().catch(() => undefined);
      const trialToken = await runtime.session.getTrialToken().catch(() => null);
      if (trialToken) {
        const trialAccount = await runtime.api.getTrialAccount().catch(() => null);
        if (trialAccount && !trialAccount.authenticated) {
          account = account.authenticated ? { ...account, freeRemaining: trialAccount.freeRemaining } : trialAccount;
        }
      }
      if (revision === accountRevision.current) applyAccount(account, locale);
    } catch (error) {
      if (revision !== accountRevision.current) return;
      if (serviceErrorCode(error) === "unauthorized") {
        await runtime.session.clearAccessToken().catch(() => undefined);
        const guest = await runtime.api.getTrialAccount().catch(() => emptyGuest);
        applyAccount(guest, locale);
        return;
      }
      if (accessToken) {
        // Keep the bearer session and make the account control retryable. A
        // transient failure must not visually sign the user out while native
        // generation and billing still use the retained session.
        dispatch({ type: "accountError" });
        return;
      }
      const guest = await runtime.api.getTrialAccount().catch(() => emptyGuest);
      applyAccount(guest, locale);
    }
  }, [applyAccount, runtime]);

  const recoverPendingPurchases = useCallback(async (locale: NativeLocale) => {
    const revision = accountRevision.current;
    const accessToken = await runtime.session.getAccessToken().catch(() => null);
    if (!accessToken || revision !== accountRevision.current) return;
    try {
      await runtime.billing.recoverPacks();
      if (revision !== accountRevision.current) return;
      if (runtime.billing.getPendingPack) {
        pendingProduct.current = runtime.billing.getPendingPack();
        setPaymentPending(!!pendingProduct.current);
        if (!pendingProduct.current) dispatch({ type: "pendingPurchaseEnded" });
      }
      await refreshAccount(locale);
    } catch {
      // Recovery prepares its own connection. Store/network failures must
      // leave drawing and account access usable.
    }
  }, [refreshAccount, runtime]);

  useEffect(() => runtime.billing.subscribeGrants?.(grant => {
    if (!grant.creditsGranted || !grant.productId?.startsWith("pack_")) return;
    if (grant.status === "already_granted" && state.purchase?.mode !== "pending") return;
    const revision = accountRevision.current;
    void (async () => {
      if (!await runtime.session.getAccessToken().catch(() => null) || revision !== accountRevision.current) return;
      if (accountSummary.current) accountSummary.current.hasPurchased = true;
      purchaseHistoryHint.current = true;
      await savePurchaseHistoryHint();
      if (revision !== accountRevision.current) return;
      if (grant.productId === pendingProduct.current) { pendingProduct.current = null; setPaymentPending(false); }
      setHasPurchased(true);
      setPurchaseNotice(fillPackText(getNativePackCopy(state.locale, grant.creditsGranted!).added, { count: grant.creditsGranted! }));
      await refreshAccount(state.locale);
      if (revision === accountRevision.current && state.purchase?.mode === "pending" && grant.productId === selectedPack) {
        offerRequest.current += 1;
        dispatch({ type: "purchaseChanged", purchase: null });
      }
    })().catch(() => undefined);
  }), [runtime, refreshAccount, savePurchaseHistoryHint, selectedPack, state.locale, state.purchase?.mode]);

  useEffect(() => {
    if (!paymentPending) return;
    let checks = 0;
    const timer = setInterval(() => {
      if (AppState.currentState !== "active" || checks >= 20) return;
      checks += 1;
      void recoverPendingPurchases(state.locale);
      if (checks === 20) clearInterval(timer);
    }, 15_000);
    return () => clearInterval(timer);
  }, [recoverPendingPurchases, state.locale, paymentPending]);

  useEffect(() => {
    let active = true;
    void runtime.session.getDetailLevel().catch(() => "simple" as DetailLevel).then(detailLevel => {
      if (active) dispatch({ type: "detailLevelLoaded", detailLevel });
    });
    return () => { active = false; };
  }, [runtime]);

  const onDetailLevelChange = useCallback((detailLevel: DetailLevel) => {
    if (!state.detailReady || generationInFlight.current) return;
    dispatch({ type: "detailLevelChanged", detailLevel });
    preferenceWrite.current = preferenceWrite.current.catch(() => undefined)
      .then(() => runtime.session.setDetailLevel(detailLevel)).catch(() => undefined);
  }, [runtime, state.detailReady]);

  useEffect(() => {
    let active = true;
    void (async () => {
      purchaseHistoryHint.current = await runtime.session.getPurchaseHistoryHint();
      const persisted = await runtime.session.getLocale().catch(() => null);
      const deviceLocale = localeFromDevice(getDeviceLocales());
      const locale = isNativeLocale(persisted) ? persisted : deviceLocale;
      if (!active) return;
      dispatch({ type: "localeChanged", locale });
      const accessToken = await runtime.session.getAccessToken().catch(() => null);
      if (!active) return;
      if (accessToken) {
        dispatch({ type: "accountLoading" });
        await refreshAccount(locale);
        if (active) void recoverPendingPurchases(locale);
      } else if (await runtime.session.getTrialToken().catch(() => null)) {
        const guest = await runtime.api.getTrialAccount().catch(() => ({ authenticated: false, email: null, balance: 0, freeRemaining: null } as AccountSummary));
        if (!active) return;
        applyAccount(guest, locale);
      } else {
        applyAccount({ authenticated: false, email: null, balance: 0, freeRemaining: null }, locale);
      }
    })();
    return () => {
      active = false;
      void runtime.billing.dispose();
    };
  }, [applyAccount, refreshAccount, recoverPendingPurchases, runtime]);

  const prepareOffer = useCallback(async (message?: string) => {
    const request = ++offerRequest.current;
    const revision = accountRevision.current;
    if (pendingProduct.current) {
      setSelectedPack(pendingProduct.current);
      dispatch({ type: "purchaseChanged", purchase: { mode: "pending", busy: true, errorLabel: undefined } });
      void recoverPendingPurchases(state.locale);
      try {
        const catalog = await runtime.billing.preparePacks();
        if (request === offerRequest.current && revision === accountRevision.current) setPackCatalog(catalog);
      } catch {
        // Catalog availability must not clear an unfinished payment or enable Buy.
      }
      return;
    }
    dispatch({ type: "purchaseChanged", purchase: { mode: "offer", busy: true, errorLabel: message } });
    try {
      const catalog = await runtime.billing.preparePacks();
      if (request !== offerRequest.current || revision !== accountRevision.current) return;
      setPackCatalog(catalog);
      if (pendingProduct.current) {
        setSelectedPack(pendingProduct.current);
        dispatch({ type: "purchaseChanged", purchase: { mode: "pending", busy: true, errorLabel: undefined } });
      } else {
        dispatch({ type: "purchaseChanged", purchase: { mode: "offer", busy: false, errorLabel: message } });
      }
    } catch {
      if (request !== offerRequest.current || revision !== accountRevision.current) return;
      if (pendingProduct.current) {
        setSelectedPack(pendingProduct.current);
        dispatch({ type: "purchaseChanged", purchase: { mode: "pending", busy: true, errorLabel: undefined } });
        return;
      }
      setPackCatalog(null);
      dispatch({ type: "purchaseChanged", purchase: { mode: "error", errorLabel: getNativePackCopy(state.locale).unavailable, busy: false } });
    }
  }, [runtime, state.locale, recoverPendingPurchases]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", nextState => {
      if (nextState !== "active" || checkoutInFlight.current) return;
      void recoverPendingPurchases(state.locale);
      if (state.modal === "purchase" && state.purchase?.mode !== "pending") void prepareOffer();
    });
    return () => subscription.remove();
  }, [recoverPendingPurchases, prepareOffer, state.locale, state.modal, state.purchase?.mode]);

  const runGeneration = useCallback(async (scene: string, detailLevel: DetailLevel = state.detailLevel, photoInput: string | undefined = photo?.base64) => {
    if (!state.detailReady || pickerInFlight.current || generationInFlight.current) return;
    photoSelectionVersion.current += 1;
    if (!photoInput && !canSubmitScene(scene, 180)) {
      dispatch({ type: "generationFailed", message: copy.errors.general, retryLabel: copy.actions.tryAgain });
      return;
    }
    if (isNativeCreditExhausted(state.freeRemaining, state.paidRemaining)) {
      void runtime.api.recordPaywall?.("tapped_create");
      void prepareOffer();
      return;
    }
    const previousGeneration = state.generation;
    generationInFlight.current = true;
    dispatch({ type: "generationStarted", loadingMessages: getNativeLoadingMessages(state.locale), statusLabel: copy.stage.loadingSr });
    try {
      const result = photoInput ? await runtime.api.generate(scene, detailLevel, photoInput) : await runtime.api.generate(scene, detailLevel);
      if (typeof result.paidRemaining === "number" || typeof result.freeRemaining === "number") {
        const summary = accountSummary.current;
        if (summary) {
          accountSummary.current = {
            ...summary,
            balance: result.paidRemaining ?? summary.balance,
            freeRemaining: result.freeRemaining ?? summary.freeRemaining,
          };
        }
        dispatch({
          type: "usageChanged",
          label: getNativeUsageLabel(state.locale, result.freeRemaining ?? state.freeRemaining, result.paidRemaining ?? state.paidRemaining),
          freeRemaining: result.freeRemaining,
          paidRemaining: result.paidRemaining,
        });
      }
      lastResultInput.current = { scene, detailLevel, ...(photoInput ? { photo: photoInput } : {}) };
      dispatch({ type: "generationReady", imageUri: result.imageUri, imageAlt: copy.stage.generatedAlt, freeRemaining: result.freeRemaining, paidRemaining: result.paidRemaining });
    } catch (error) {
      const code = serviceErrorCode(error);
      if (code === "payment_required") {
        dispatch({ type: "generationRestored", generation: previousGeneration });
        void runtime.api.recordPaywall?.("tapped_create");
        void prepareOffer();
        return;
      }
      const photoMessage = photoInput ? photoFailureMessage(code, getPhotoCopy(state.locale)) : undefined;
      const message = photoMessage ?? (code === "rate_limited"
        ? copy.errors.rateLimited
        : code === "timeout"
          ? copy.errors.timeout
          : code === "refused"
            ? copy.errors.refused
          : code === "native_generation_unavailable" || code === "native_attestation_required" || code === "native_attestation_failed"
            ? copy.errors.unavailable
            : code === "unauthorized"
            ? copy.auth.authError
              : copy.errors.general);
      dispatch({ type: "generationFailed", message, retryLabel: copy.actions.tryAgain });
    } finally {
      generationInFlight.current = false;
    }
  }, [copy, prepareOffer, runtime, state.account.status, state.freeRemaining, state.generation, state.locale, state.paidRemaining, state.detailLevel, state.detailReady, photo]);

  const onCreate = useCallback(() => { void runGeneration(state.scene); }, [runGeneration, state.scene]);
  const onRetry = useCallback(() => { void runGeneration(state.scene); }, [runGeneration, state.scene]);
  const onRedraw = useCallback(() => { dispatch({ type: "modalChanged", modal: "none" }); const input = lastResultInput.current; if (input) void runGeneration(input.scene, input.detailLevel, input.photo); }, [runGeneration]);

  const onSceneChange = useCallback((scene: string) => dispatch({ type: "sceneChanged", scene }), []);
  const refreshSuggestions = useCallback(() => {
    const ids = pickNativeSuggestionIds(baseCopy.suggestions.items, recentSuggestionIds.current);
    recentSuggestionIds.current = [...ids];
    setSuggestionIds(ids);
  }, [baseCopy.suggestions.items]);
  const onNewScene = useCallback(() => {
    onRemovePhoto(); lastResultInput.current = null;
    refreshSuggestions();
    dispatch({ type: "newScene" });
  }, [refreshSuggestions, onRemovePhoto]);
  const onResultBack = useCallback(() => dispatch({ type: "resultBack" }), []);
  const onTabChange = useCallback((tab: NativeDoodleUiProps["tab"]) => dispatch({ type: "tabChanged", tab }), []);
  const onSelectIdea = useCallback((id: string) => {
    if (state.generation.status === "waiting") return;
    const idea = ideas.find((item) => item.id === id);
    if (idea) { onRemovePhoto(); dispatch({ type: "ideaSelected", scene: idea.prompt }); }
  }, [ideas, state.generation.status, onRemovePhoto]);
  const onOpenMore = useCallback(() => dispatch({ type: "modalChanged", modal: "more" }), []);
  const onOpenReport = useCallback(() => {
    setReportState({ pending: false });
    dispatch({ type: "modalChanged", modal: "report" });
  }, []);
  const onOpenLarger = useCallback(() => dispatch({ type: "modalChanged", modal: "image" }), []);
  const onCloseModal = useCallback(() => dispatch({ type: "modalChanged", modal: "none" }), []);
  const onDownload = useCallback(() => {
    if (state.generation.status === "ready" && typeof state.generation.imageUri === "string") {
      void runtime.media.download(state.generation.imageUri)
        .then(() => Alert.alert(copy.actions.download, mediaFeedback(state.locale).downloadSuccess))
        .catch(() => Alert.alert(copy.actions.download, copy.errors.general));
    }
  }, [copy, runtime, state.generation, state.locale]);
  const onShare = useCallback(() => {
    if (state.generation.status === "ready" && typeof state.generation.imageUri === "string") {
      void runtime.media.share(state.generation.imageUri)
        .then(() => Alert.alert(copy.result.share, mediaFeedback(state.locale).shareSuccess))
        .catch(() => Alert.alert(copy.result.share, copy.errors.general));
    }
  }, [copy, runtime, state.generation, state.locale]);
  const onReportSubmit = useCallback((report: NativeReportSubmission) => {
    if (reportInFlight.current) return;
    reportInFlight.current = true;
    setReportState({ pending: true });
    const imageUri = state.generation.status === "ready" && typeof state.generation.imageUri === "string" ? state.generation.imageUri : undefined;
    void runtime.reports.submit({ locale: state.locale, report, scene: lastResultInput.current?.photo ? "Photo doodle" : state.scene, imageUri }).then(() => {
      setReportState({ pending: false });
      dispatch({ type: "modalChanged", modal: "none" });
      Alert.alert(copy.report.title, copy.report.success);
    }).catch(() => {
      setReportState({ pending: false, error: copy.report.error });
    }).finally(() => {
      reportInFlight.current = false;
    });
  }, [copy.report.error, copy.report.success, copy.report.title, runtime, state.generation, state.locale, state.scene]);

  const onSignIn = useCallback(() => {
    dispatch({ type: "accountLoading" });
    void runtime.auth.signIn().then(async () => {
      await refreshAccount(state.locale);
      await recoverPendingPurchases(state.locale);
      dispatch({ type: "accountModalChanged", modal: "closed" });
    }).catch((error) => {
      void runtime.api.getTrialAccount().catch(() => ({ authenticated: false, email: null, balance: 0, freeRemaining: null } as AccountSummary)).then((guest) => applyAccount(guest, state.locale));
      void error;
    });
  }, [applyAccount, copy, recoverPendingPurchases, refreshAccount, runtime, state.locale, state.purchase?.mode]);

  const onOpenAccount = useCallback(() => {
    if (state.account.status === "error") {
      dispatch({ type: "accountLoading" });
      void refreshAccount(state.locale);
      return;
    }
    if (state.account.status === "signedOut") {
      onSignIn();
      return;
    }
    dispatch({ type: "accountModalChanged", modal: "menu" });
  }, [onSignIn, refreshAccount, state.account.status, state.locale]);
  const onCloseAccount = useCallback(() => dispatch({ type: "accountModalChanged", modal: "closed" }), []);

  const onRefill = useCallback(() => {
    if (isNativeCreditExhausted(state.freeRemaining, state.paidRemaining)) void runtime.api.recordPaywall?.("get_more");
    void prepareOffer();
  }, [prepareOffer, runtime, state.freeRemaining, state.paidRemaining]);

  const completePurchase = useCallback(async (restore: boolean) => {
    if (checkoutInFlight.current || pendingProduct.current || !packCatalog) return;
    const pack = packCatalog.packs.find(item => item.productId === selectedPack);
    if (!pack) return;
    const revision = accountRevision.current;
    checkoutInFlight.current = true;
    dispatch({ type: "purchaseChanged", purchase: { mode: "checkout", busy: true, errorLabel: undefined } });
    try {
      if (!await runtime.session.getAccessToken()) {
        dispatch({ type: "accountLoading" });
        await runtime.auth.signIn();
        await refreshAccount(state.locale);
      }
      if (revision !== accountRevision.current) return;
      if (restore) {
        await runtime.billing.recoverPacks();
      } else {
        const result = await runtime.billing.buyPack(selectedPack, pack.credits);
        if (revision !== accountRevision.current) return;
        if (!result.creditsGranted) throw new Error("Missing verified grant");
        if (accountSummary.current) accountSummary.current.hasPurchased = true;
        purchaseHistoryHint.current = true;
        await savePurchaseHistoryHint();
        setHasPurchased(true);
        setPurchaseNotice(fillPackText(getNativePackCopy(state.locale, result.creditsGranted).added, { count: result.creditsGranted }));
      }
      await refreshAccount(state.locale);
      if (revision !== accountRevision.current) return;
      pendingProduct.current = null; setPaymentPending(false);
      offerRequest.current += 1;
      dispatch({ type: "purchaseChanged", purchase: null });
    } catch (error) {
      if (revision !== accountRevision.current) return;
      const code = serviceErrorCode(error);
      if (code === "purchase_pending") { pendingProduct.current = runtime.billing.getPendingPack?.() ?? selectedPack; setSelectedPack(pendingProduct.current); setPaymentPending(true); }
      if (code === "offer_changed") {
        await prepareOffer(getNativePackCopy(state.locale).offerChanged);
      } else {
        dispatch({ type: "purchaseChanged", purchase: code === "purchase_pending" ? { mode: "pending", busy: true, errorLabel: undefined } : { mode: "error", errorLabel: copy.purchase.checkoutError, busy: false } });
        if (!await runtime.session.getAccessToken().catch(() => null)) await refreshAccount(state.locale);
      }
    } finally {
      checkoutInFlight.current = false;
    }
  }, [copy.purchase.checkoutError, packCatalog, prepareOffer, refreshAccount, runtime, savePurchaseHistoryHint, selectedPack, state.locale]);

  const onPurchase = useCallback(() => {
    if (!packCatalog) { void prepareOffer(); return; }
    void completePurchase(false);
  }, [completePurchase, packCatalog, prepareOffer]);
  const onRestore = useCallback(() => { void completePurchase(true); }, [completePurchase]);
  const onSelectPack = useCallback((productId: PlayPackId) => {
    if (!checkoutInFlight.current && !pendingProduct.current) setSelectedPack(productId);
  }, []);
  const onCancelPurchase = useCallback(() => {
    if (checkoutInFlight.current) return;
    offerRequest.current += 1;
    dispatch({ type: "purchaseChanged", purchase: null });
  }, []);

  const onSignOut = useCallback(() => {
    accountRevision.current += 1; runtime.billing.resetAccount?.();
    pendingProduct.current = null; setPaymentPending(false); setPurchaseNotice(undefined);
    offerRequest.current += 1; dispatch({ type: "purchaseChanged", purchase: null });
    void Promise.allSettled([runtime.api.signOut(), runtime.auth.signOut()]).then(() => {
      void runtime.api.getTrialAccount().catch(() => ({ authenticated: false, email: null, balance: 0, freeRemaining: null } as AccountSummary)).then((guest) => {
        accountSummary.current = null;
        applyAccount(guest, state.locale);
      });
      dispatch({ type: "accountModalChanged", modal: "closed" });
    });
  }, [applyAccount, runtime, state.locale]);
  const onDeleteRequest = useCallback(() => dispatch({ type: "accountModalChanged", modal: "deleteConfirm" }), []);
  const onDeleteConfirm = useCallback(
    () => runtime.api.deleteAccount().then(async () => {
      accountRevision.current += 1; runtime.billing.resetAccount?.();
      pendingProduct.current = null; setPaymentPending(false); setPurchaseNotice(undefined);
      offerRequest.current += 1; dispatch({ type: "purchaseChanged", purchase: null });
      accountSummary.current = null;
      purchaseHistoryHint.current = undefined;
      await purchaseHistoryWrites.current;
      await runtime.session.clearPurchaseHistoryHint().catch(() => undefined);
      applyAccount({ authenticated: false, email: null, balance: 0, freeRemaining: null }, state.locale);
      dispatch({ type: "accountModalChanged", modal: "closed" });
    }).catch(() => undefined),
    [applyAccount, runtime, state.locale],
  );
  const onLocaleChange = useCallback((locale: NativeLocale) => {
    void runtime.session.setLocale(locale).catch(() => undefined);
    dispatch({ type: "localeChanged", locale });
    const summary = accountSummary.current;
    if (summary) applyAccount(summary, locale);
  }, [applyAccount, runtime]);
  const onSupportLink = useCallback((id: "contact" | "privacy" | "terms" | "refunds") => {
    const url = id === "contact" ? "mailto:hello@samistudio.nl" : `https://doodle.samistudio.nl/${id === "refunds" ? "refund" : id}`;
    void Linking.openURL(url).catch(() => undefined);
  }, []);
  const onShareDiagnostics = useCallback(() => {
    void runtime.diagnostics.exportAndShare(copy.settings.shareDiagnostics).catch(() => {
      Alert.alert(copy.settings.shareDiagnostics, copy.errors.general);
    });
  }, [copy.errors.general, copy.settings.shareDiagnostics, runtime]);

  const purchase = state.purchase ? packCatalog
    ? makePackPurchaseUi(state.locale, packCatalog, selectedPack, exhaustedPurchaseHistory(hasPurchased, state.freeRemaining, state.paidRemaining), {
        mode: state.purchase.mode, busy: state.purchase.busy, errorLabel: state.purchase.errorLabel,
      })
    : makePurchaseUi(copy, state.purchase.mode, {
        title: packCopy.title, body: packCopy.terms, busy: state.purchase.busy, errorLabel: state.purchase.errorLabel, cancelLabel: packCopy.notNow,
      }) : undefined;
  const draftCount = characterCountLabel(state.scene, 180);
  return {
    photo, preparingPhoto, photoError, onPickPhoto, onRemovePhoto,
    detailLevel: state.detailLevel,
    detailReady: state.detailReady,
    onDetailLevelChange,
    locale: state.locale,
    direction: nativeDirection(state.locale),
    tab: state.tab,
    copy,
    draft: { scene: state.scene, sceneSource: state.sceneSource, revision: state.revision, hasContent: state.scene.trim().length > 0, maxLength: 180, usedLength: draftCount.used, remainingLength: draftCount.remaining, characterCountLabel: `${draftCount.remaining}` },
    generation: state.generation,
    usage: resultUsage(state),
    account: state.account,
    accountModal: state.accountModal,
    ideas,
    referenceImageUri: NATIVE_REFERENCE_IMAGE,
    locales,
    supportLinks,
    purchase,
    purchaseNotice,
    reportState,
    modal: state.modal,
    onTabChange,
    onSceneChange,
    onRefreshSuggestions: refreshSuggestions,
    onCreate,
    onRetry,
    onSelectIdea,
    onDownload,
    onShare,
    onNewScene,
    onResultBack,
    onRedraw,
    onOpenMore,
    onOpenReport,
    onReportSubmit,
    onOpenLarger,
    onCloseModal,
    onOpenAccount,
    onCloseAccount,
    onSignIn,
    onRefill,
    onPurchase,
    onSelectPack,
    onRestore,
    onCancelPurchase,
    onSignOut,
    onDeleteRequest,
    onDeleteConfirm,
    onLocaleChange,
    onSupportLink,
    onShareDiagnostics,
  };
}


function mediaFeedback(locale: NativeLocale): { downloadSuccess: string; shareSuccess: string } {
  return {
    en: { downloadSuccess: "Saved to your photos.", shareSuccess: "Ready to share." },
    nl: { downloadSuccess: "Opgeslagen in je foto's.", shareSuccess: "Klaar om te delen." },
    de: { downloadSuccess: "In deinen Fotos gespeichert.", shareSuccess: "Bereit zum Teilen." },
    fr: { downloadSuccess: "Enregistré dans vos photos.", shareSuccess: "Prêt à être partagé." },
    es: { downloadSuccess: "Guardado en tus fotos.", shareSuccess: "Listo para compartir." },
    "pt-br": { downloadSuccess: "Salvo nas suas fotos.", shareSuccess: "Pronto para compartilhar." },
    it: { downloadSuccess: "Salvato nelle tue foto.", shareSuccess: "Pronto per la condivisione." },
    ja: { downloadSuccess: "写真に保存しました。", shareSuccess: "共有する準備ができました。" },
    ko: { downloadSuccess: "사진에 저장했어요.", shareSuccess: "공유할 준비가 됐어요." },
    ar: { downloadSuccess: "تم الحفظ في صورك.", shareSuccess: "الرسمة جاهزة للمشاركة." },
  }[locale];
}
