"use client";

import { useEffect, useRef, useState } from "react";
import type { AccountSummary } from "@/app/api/account/route";
import type { DoodleCopy, Locale } from "@/lib/i18n";
import { GoogleSignInButton } from "./google-sign-in-button";
import { ApplePayCheckout } from "./apple-pay-checkout";
import { isPlayRuntime, preparePlayPurchase, purchasePlayPack, recoverPlayPurchases, type PreparedPlayPurchase } from "@/lib/billing/play-client";

type PurchaseStep = "offer" | "signIn" | "checkout";

interface PurchaseDialogProps {
  open: boolean; account: AccountSummary; scene: string; locale: Locale; copy: DoodleCopy; success: boolean;
  errorMessage?: string | null; confirmationBusy?: boolean; onRetryConfirmation?: () => void; onRestoreFocus?: () => void;
  onClose: () => void; onAccountChange: (account: AccountSummary) => void; signInOnly?: boolean;
  onExpressCheckoutComplete?: (sessionId: string) => void;
}

export function PurchaseDialog({ open, account, scene, locale, copy, success, errorMessage, confirmationBusy = false, onRetryConfirmation, onRestoreFocus, onClose, onAccountChange, onExpressCheckoutComplete, signInOnly = false }: PurchaseDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  const [step, setStep] = useState<PurchaseStep>(signInOnly ? "signIn" : "offer");
  const [busy, setBusy] = useState(false);
  const [applePayBusy, setApplePayBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playRuntime] = useState(isPlayRuntime);
  const [preparedPlay, setPreparedPlay] = useState<PreparedPlayPurchase | null>(null);
  const [playSuccess, setPlaySuccess] = useState(false);
  const [signedInHere, setSignedInHere] = useState(false);
  const [prepareAttempt, setPrepareAttempt] = useState(0);
  const authenticated = account.authenticated || signedInHere;
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open || signInOnly || !playRuntime || !authenticated) return;
    let active = true;
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      setPreparedPlay(null);
      setBusy(true);
      setError(null);
      try {
        const prepared = await preparePlayPurchase();
        const restored = await recoverPlayPurchases(prepared.service);
        if (!active) return;
        if (restored.recovered > 0) {
          const response = await fetch("/api/account", { cache: "no-store" });
          if (!response.ok) throw new Error("account unavailable");
          const next = await response.json() as AccountSummary;
          if (!active) return;
          onAccountChange(next);
          if (next.balance > 0) { closeRef.current(); return; }
        }
        setPreparedPlay(prepared);
        if (restored.failed > 0) setError(copy.purchase.checkoutError);
      } catch { if (active) setError(copy.purchase.checkoutError); }
      finally { if (active) setBusy(false); }
    })();
    return () => { active = false; };
  }, [open, signInOnly, playRuntime, authenticated, account.email, prepareAttempt, copy.purchase.checkoutError, onAccountChange]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
    return () => { if (dialog.open && typeof dialog.close === "function") dialog.close(); if (onRestoreFocus) onRestoreFocus(); else previousFocus.current?.focus(); previousFocus.current = null; };
  }, [onRestoreFocus, open]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      const target = signInOnly && step === "signIn"
        ? dialog?.querySelector<HTMLElement>("[data-purchase-initial-focus]") ?? dialog?.querySelector<HTMLElement>("[data-purchase-focus]")
        : dialog?.querySelector<HTMLElement>("[data-purchase-focus]");
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, signInOnly, step, success, playSuccess]);

  if (!open) return null;
  const saveReturn = (intent: "auth" | "checkout") => sessionStorage.setItem("doodle:return", JSON.stringify({ scene, intent }));
  const refreshAccount = async () => {
    const response = await fetch("/api/account", { cache: "no-store" });
    if (!response.ok) throw new Error("account unavailable");
    const next = await response.json() as AccountSummary;
    onAccountChange(next);
    return next;
  };
  const beginCheckout = async () => {
    if (isPlayRuntime()) {
      if (!preparedPlay || !authenticated) { setError(copy.purchase.checkoutError); return; }
      setBusy(true); setError(null);
      try {
        await purchasePlayPack(preparedPlay);
        setPlaySuccess(true);
        await refreshAccount();
      } catch (failure) {
        if (!(failure instanceof Error && failure.name === "AbortError")) setError(copy.purchase.checkoutError);
      } finally { setBusy(false); }
      return;
    }
    saveReturn("checkout"); setStep("checkout"); setBusy(true); setError(null);
    try {
      const response = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale }) });
      const body = await response.json() as { url?: unknown };
      if (!response.ok || typeof body.url !== "string") throw new Error("checkout unavailable");
      location.assign(body.url);
    } catch { setStep("offer"); setError(copy.purchase.checkoutError); setBusy(false); }
  };
  const startCheckout = () => authenticated ? void beginCheckout() : (setStep("signIn"), setError(null));
  const signIn = async (credential: string) => {
    setBusy(true); setError(null);
    if (!signInOnly) saveReturn("auth");
    try {
      const response = await fetch("/api/auth/google", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credential }) });
      if (!response.ok) throw new Error("auth unavailable");
      const next = await refreshAccount();
      if (signInOnly) {
        if (!next.authenticated) throw new Error("auth unavailable");
        setBusy(false);
        onClose();
      } else if (isPlayRuntime()) {
        if (!next.authenticated) throw new Error("auth unavailable");
        setSignedInHere(true); setStep("offer"); setBusy(false);
      } else if (next.balance > 0) onClose(); else await beginCheckout();
    } catch { setError(copy.auth.authError); setBusy(false); }
  };
  const offer = step === "offer" || step === "checkout";
  const price = playRuntime ? (preparedPlay ? new Intl.NumberFormat(locale, { style: "currency", currency: preparedPlay.product.price.currency }).format(Number(preparedPlay.product.price.value)) : "—") : copy.purchase.price;
  const purchaseDisabled = busy || applePayBusy || confirmationBusy || (playRuntime && authenticated && !preparedPlay);
  const handleApplePayBusyChange = (nextBusy: boolean) => {
    if (nextBusy) saveReturn("checkout");
    setApplePayBusy(nextBusy);
  };

  return <dialog ref={dialogRef} className={`purchase-dialog${step === "signIn" ? " purchase-dialog-sign-in" : ""}`} aria-labelledby="purchase-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="purchase-slip">
      {success || playSuccess ? <div className="purchase-success"><p className="purchase-label">{copy.purchase.label}</p><h2 id="purchase-title">{copy.purchase.added}</h2><button className="purchase-primary" type="button" data-purchase-focus onClick={onClose}>{copy.purchase.startDrawing}</button></div> : <>
        <header className="purchase-heading"><p className="purchase-label">{signInOnly ? copy.account.label : copy.purchase.label}</p><h2 id="purchase-title" tabIndex={signInOnly ? -1 : undefined} data-purchase-initial-focus={signInOnly ? "" : undefined}>{signInOnly ? copy.auth.signIn : copy.purchase.title}</h2></header>
        {offer ? <div className="purchase-offer"><div className="purchase-lockup"><strong>{copy.purchase.quantity}</strong><strong dir="ltr">{price}</strong></div><p>{copy.purchase.reassurance}</p><p className="purchase-fine-print">{copy.purchase.failedDontCount}</p>{error || errorMessage ? <p role="alert" className="purchase-error">{error ?? errorMessage}</p> : null}{!playRuntime && authenticated && !onRetryConfirmation && onExpressCheckoutComplete ? <ApplePayCheckout locale={locale} ariaLabel={copy.purchase.applePay} unavailableMessage={copy.purchase.checkoutError} onComplete={onExpressCheckoutComplete} onError={setError} onBusyChange={handleApplePayBusyChange} /> : null}<div className="purchase-actions"><button className={`purchase-primary${busy || applePayBusy || confirmationBusy ? " is-loading" : ""}`} type="button" data-purchase-focus onClick={playRuntime ? startCheckout : (onRetryConfirmation ?? startCheckout)} disabled={purchaseDisabled} aria-busy={busy || applePayBusy || confirmationBusy}>{!playRuntime && onRetryConfirmation ? copy.actions.tryAgain : copy.purchase.buy}</button><button className="purchase-secondary" type="button" onClick={onClose}>{copy.purchase.cancel}</button>{playRuntime && authenticated && error ? <button className="purchase-text-action" type="button" disabled={busy} onClick={() => setPrepareAttempt((attempt) => attempt + 1)}>{copy.actions.tryAgain}</button> : null}{!authenticated ? <button className="purchase-text-action" type="button" onClick={() => setStep("signIn")}>{copy.purchase.restore}</button> : null}</div></div> : <div className="purchase-auth">{error ? <p role="alert" className="purchase-error">{error}</p> : null}<GoogleSignInButton locale={locale} busy={busy} loadingLabel={copy.auth.loading} onCredential={signIn} onError={() => setError(copy.auth.authError)} /><button className="purchase-text-action purchase-auth-cancel" type="button" data-purchase-focus onClick={onClose}>{copy.purchase.cancel}</button></div>}
      </>}
    </div>
  </dialog>;
}
