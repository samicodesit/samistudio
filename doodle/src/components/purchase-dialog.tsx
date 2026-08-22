"use client";

import { useEffect, useRef, useState } from "react";
import type { AccountSummary } from "@/app/api/account/route";
import type { DoodleCopy, Locale } from "@/lib/i18n";
import { GoogleSignInButton } from "./google-sign-in-button";

type PurchaseStep = "offer" | "signIn" | "checkout";

interface PurchaseDialogProps {
  open: boolean; account: AccountSummary; scene: string; locale: Locale; copy: DoodleCopy; success: boolean;
  errorMessage?: string | null; confirmationBusy?: boolean; onRetryConfirmation?: () => void; onRestoreFocus?: () => void;
  onClose: () => void; onAccountChange: (account: AccountSummary) => void;
}

export function PurchaseDialog({ open, account, scene, locale, copy, success, errorMessage, confirmationBusy = false, onRetryConfirmation, onRestoreFocus, onClose, onAccountChange }: PurchaseDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [step, setStep] = useState<PurchaseStep>("offer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
    return () => { if (dialog.open && typeof dialog.close === "function") dialog.close(); if (onRestoreFocus) onRestoreFocus(); else previousFocus.current?.focus(); previousFocus.current = null; };
  }, [onRestoreFocus, open]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>("[data-purchase-focus]")?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, step, success]);

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
    saveReturn("checkout"); setStep("checkout"); setBusy(true); setError(null);
    try {
      const response = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale }) });
      const body = await response.json() as { url?: unknown };
      if (!response.ok || typeof body.url !== "string") throw new Error("checkout unavailable");
      location.assign(body.url);
    } catch { setStep("offer"); setError(copy.purchase.checkoutError); setBusy(false); }
  };
  const startCheckout = () => account.authenticated ? void beginCheckout() : (setStep("signIn"), setError(null));
  const signIn = async (credential: string) => {
    setBusy(true); setError(null); saveReturn("auth");
    try {
      const response = await fetch("/api/auth/google", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credential }) });
      if (!response.ok) throw new Error("auth unavailable");
      const next = await refreshAccount();
      if (next.balance > 0) onClose(); else await beginCheckout();
    } catch { setError(copy.auth.authError); setBusy(false); }
  };
  const offer = step === "offer" || step === "checkout";

  return <dialog ref={dialogRef} className="purchase-dialog" aria-labelledby="purchase-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="purchase-slip">
      {success ? <div className="purchase-success"><p className="purchase-label">{copy.purchase.label}</p><h2 id="purchase-title">{copy.purchase.added}</h2><button className="purchase-primary" type="button" data-purchase-focus onClick={onClose}>{copy.purchase.startDrawing}</button></div> : <>
        <header className="purchase-heading"><p className="purchase-label">{copy.purchase.label}</p><h2 id="purchase-title">{copy.purchase.title}</h2></header>
        {offer ? <div className="purchase-offer"><div className="purchase-lockup"><strong>{copy.purchase.quantity}</strong><strong dir="ltr">{copy.purchase.price}</strong></div><p>{copy.purchase.reassurance}</p><p className="purchase-fine-print">{copy.purchase.failedDontCount}</p>{error || errorMessage ? <p role="alert" className="purchase-error">{error ?? errorMessage}</p> : null}<div className="purchase-actions"><button className="purchase-primary" type="button" data-purchase-focus onClick={onRetryConfirmation ?? startCheckout} disabled={busy || confirmationBusy}>{onRetryConfirmation ? copy.actions.tryAgain : copy.purchase.buy}</button><button className="purchase-secondary" type="button" onClick={onClose}>{copy.purchase.cancel}</button>{!account.authenticated ? <button className="purchase-text-action" type="button" onClick={() => setStep("signIn")}>{copy.purchase.restore}</button> : null}</div></div> : <div className="purchase-auth">{error ? <p role="alert" className="purchase-error">{error}</p> : null}<GoogleSignInButton locale={locale} busy={busy} onCredential={signIn} onError={() => setError(copy.auth.authError)} /><button className="purchase-text-action" type="button" data-purchase-focus onClick={onClose}>{copy.purchase.cancel}</button></div>}
      </>}
    </div>
  </dialog>;
}
