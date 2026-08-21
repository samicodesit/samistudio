"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import type { AccountSummary } from "@/app/api/account/route";
import type { DoodleCopy, Locale } from "@/lib/i18n";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type PurchaseStep = "offer" | "signIn" | "emailCode" | "checkout";

function normalizeOtp(value: string) {
  return value
    .replace(/[٠-٩۰-۹]/g, (digit) => {
      const point = digit.charCodeAt(0);
      return String(point - (point <= 0x0669 ? 0x0660 : 0x06f0));
    })
    .replace(/\D/g, "")
    .slice(0, 6);
}

interface PurchaseDialogProps {
  open: boolean;
  account: AccountSummary;
  scene: string;
  locale: Locale;
  copy: DoodleCopy;
  success: boolean;
  errorMessage?: string | null;
  confirmationBusy?: boolean;
  onRetryConfirmation?: () => void;
  onRestoreFocus?: () => void;
  onClose: () => void;
  onAccountChange: (account: AccountSummary) => void;
}

export function PurchaseDialog({
  open,
  account,
  scene,
  locale,
  copy,
  success,
  errorMessage,
  confirmationBusy = false,
  onRetryConfirmation,
  onRestoreFocus,
  onClose,
  onAccountChange,
}: PurchaseDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [step, setStep] = useState<PurchaseStep>("offer");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;

    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");

    return () => {
      if (dialog.open && typeof dialog.close === "function") dialog.close();
      if (onRestoreFocus) onRestoreFocus();
      else previousFocus.current?.focus();
      previousFocus.current = null;
    };
  }, [onRestoreFocus, open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open || step === "checkout") return;
    const frame = requestAnimationFrame(() => {
      dialog.querySelector<HTMLElement>("[data-purchase-focus]")?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [codeSent, open, step, success]);

  if (!open) return null;

  function saveReturn(intent: "auth" | "checkout") {
    sessionStorage.setItem("doodle:return", JSON.stringify({ scene, intent }));
  }

  async function refreshAccount() {
    const response = await fetch("/api/account", { cache: "no-store" });
    if (!response.ok) throw new Error("account unavailable");
    const nextAccount = (await response.json()) as AccountSummary;
    onAccountChange(nextAccount);
  }

  async function startGoogle() {
    setBusy(true);
    setError(null);
    saveReturn("auth");
    try {
      const { error: authError } = await getBrowserSupabase().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${location.origin}/auth/callback?locale=${locale}` },
      });
      if (authError) throw authError;
    } catch {
      setBusy(false);
      setError(copy.auth.authError);
    }
  }

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    const address = email.trim();
    if (!address) return;
    setBusy(true);
    setError(null);
    try {
      const { error: authError } = await getBrowserSupabase().auth.signInWithOtp({
        email: address,
        options: { shouldCreateUser: true },
      });
      if (authError) throw authError;
      setCodeSent(true);
      setOtpVerified(false);
    } catch {
      setError(copy.auth.authError);
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    const token = normalizeOtp(code);
    if (!otpVerified && !/^\d{6}$/.test(token)) {
      setError(copy.auth.invalidCode);
      return;
    }
    setBusy(true);
    setError(null);
    if (!otpVerified) {
      try {
        const { error: authError } = await getBrowserSupabase().auth.verifyOtp({
          email: email.trim(),
          token,
          type: "email",
        });
        if (authError) throw authError;
        setOtpVerified(true);
      } catch {
        setError(copy.auth.invalidCode);
        setBusy(false);
        return;
      }
    }
    try {
      await refreshAccount();
      setStep("offer");
      setCode("");
      setCodeSent(false);
      setOtpVerified(false);
    } catch {
      setError(copy.auth.authError);
    } finally {
      setBusy(false);
    }
  }

  async function startCheckout() {
    if (!account.authenticated) {
      setStep("signIn");
      setError(null);
      return;
    }

    saveReturn("checkout");
    setStep("checkout");
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      if (!response.ok) throw new Error("checkout unavailable");
      const body = (await response.json()) as { url?: unknown };
      if (typeof body.url !== "string") throw new Error("checkout unavailable");
      location.assign(body.url);
    } catch {
      setStep("offer");
      setBusy(false);
      setError(copy.purchase.checkoutError);
    }
  }

  const offer = step === "offer" || step === "checkout";

  return (
    <dialog
      ref={dialogRef}
      className="purchase-dialog"
      aria-labelledby="purchase-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="purchase-slip">
        {success ? (
          <div className="purchase-success">
            <p className="purchase-label">{copy.purchase.label}</p>
            <h2 id="purchase-title">{copy.purchase.added}</h2>
            <button className="purchase-primary" type="button" data-purchase-focus onClick={onClose}>
              {copy.purchase.startDrawing}
            </button>
          </div>
        ) : (
          <>
            <header className="purchase-heading">
              <p className="purchase-label">{copy.purchase.label}</p>
              <h2 id="purchase-title">{copy.purchase.title}</h2>
            </header>

            {offer ? (
              <div className="purchase-offer">
                <div className="purchase-lockup">
                  <strong>{copy.purchase.quantity}</strong>
                  <strong dir="ltr">{copy.purchase.price}</strong>
                </div>
                <p>{copy.purchase.reassurance}</p>
                <p className="purchase-fine-print">{copy.purchase.failedDontCount}</p>
                {error || errorMessage ? <p role="alert" className="purchase-error">{error ?? errorMessage}</p> : null}
                <div className="purchase-actions">
                  <button
                    className="purchase-primary"
                    type="button"
                    data-purchase-focus
                    onClick={onRetryConfirmation ?? startCheckout}
                    disabled={busy || confirmationBusy}
                  >
                    {onRetryConfirmation ? copy.actions.tryAgain : copy.purchase.buy}
                  </button>
                  <button className="purchase-secondary" type="button" onClick={onClose}>
                    {copy.purchase.cancel}
                  </button>
                  {!account.authenticated ? (
                    <button className="purchase-text-action" type="button" onClick={() => setStep("signIn")}>
                      {copy.purchase.restore}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : step === "signIn" ? (
              <div className="purchase-auth">
                {error ? <p role="alert" className="purchase-error">{error}</p> : null}
                <button className="purchase-primary" type="button" data-purchase-focus onClick={startGoogle} disabled={busy}>
                  {copy.auth.google}
                </button>
                {process.env.NEXT_PUBLIC_EMAIL_OTP_ENABLED === "true" ? (
                  <button className="purchase-secondary" type="button" onClick={() => setStep("emailCode")} disabled={busy}>
                    {copy.auth.email}
                  </button>
                ) : null}
                <button className="purchase-text-action" type="button" onClick={onClose}>
                  {copy.purchase.cancel}
                </button>
              </div>
            ) : (
              <div className="purchase-auth">
                <form onSubmit={codeSent ? verifyCode : sendCode}>
                  <label htmlFor="purchase-email">{copy.auth.emailLabel}</label>
                  <input
                    id="purchase-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={busy || codeSent}
                    required
                    data-purchase-focus={!codeSent || undefined}
                  />
                  {codeSent ? (
                    <>
                      <label htmlFor="purchase-code">{copy.auth.codeLabel}</label>
                      <input
                        id="purchase-code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        value={code}
                        onChange={(event) => setCode(normalizeOtp(event.target.value))}
                        disabled={busy}
                        data-purchase-focus
                      />
                    </>
                  ) : null}
                  {error ? <p role="alert" className="purchase-error">{error}</p> : null}
                  <button className="purchase-primary" type="submit" disabled={busy}>
                    {codeSent ? copy.auth.verifyCode : copy.auth.sendCode}
                  </button>
                </form>
                <button className="purchase-text-action" type="button" onClick={onClose}>
                  {copy.purchase.cancel}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </dialog>
  );
}
