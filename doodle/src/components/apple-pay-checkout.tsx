"use client";

import { useEffect, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import type { StripeExpressCheckoutElementConfirmEvent } from "@stripe/stripe-js";
import {
  CheckoutElementsProvider,
  ExpressCheckoutElement,
  CurrencySelectorElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";
import type { Locale } from "@/lib/i18n";
import { getPackCopy, getWalletTotalLabel } from "@/lib/pack-copy";
import {
  APPLE_PAY_DIAGNOSTIC_PATH,
  mapApplePayAvailability,
  mapApplePayHttpStatus,
  type ApplePayDiagnosticEvent,
} from "@/lib/billing/apple-pay-diagnostics";

interface ApplePayCheckoutProps {
  locale: Locale;
  productId?: string;
  expectedCredits?: number;
  onBeforeConfirm?: () => Promise<void>;
  ariaLabel: string;
  unavailableMessage: string;
  onComplete: (sessionId: string) => void;
  onError: (message: string) => void;
  onBusyChange: (busy: boolean) => void;
}

function reportDiagnostic(event: ApplePayDiagnosticEvent) {
  if (typeof window === "undefined") return;
  try {
    void fetch(APPLE_PAY_DIAGNOSTIC_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Diagnostics are deliberately best effort and never affect checkout.
  }
}

function ApplePayButton({ locale, productId, ariaLabel, unavailableMessage, onComplete, onError, onBusyChange, onBeforeConfirm }: Omit<ApplePayCheckoutProps, "expectedCredits">) {
  const checkoutState = useCheckoutElements();
  const [availability, setAvailability] = useState<"pending" | "available" | "unavailable">("pending");
  const [currencyReady, setCurrencyReady] = useState(false);
  const [currencyFailed, setCurrencyFailed] = useState(false);

  useEffect(() => {
    if (checkoutState.type === "loading") return;
    reportDiagnostic(checkoutState.type === "error"
      ? { stage: "provider", outcome: "failure", reason: "provider_error" }
      : { stage: "provider", outcome: "success", reason: "ready" });
  }, [checkoutState.type]);

  if (checkoutState.type === "loading") return null;
  if (checkoutState.type === "error") return null;

  const adaptive = Boolean(productId);
  const checkout = checkoutState.checkout;
  const needsSelector = adaptive && Boolean(checkout.currencyOptions?.length);
  const total = checkout.total?.total;
  const quoteReady = !adaptive || (typeof total?.amount === "string" && total.amount.length > 0 && /^[a-z]{3}$/i.test(checkout.currency) && (!needsSelector || currencyReady) && !currencyFailed);
  const walletVisible = availability === "available" && quoteReady;

  const handleConfirm = async (event: StripeExpressCheckoutElementConfirmEvent) => {
    if (!quoteReady) {
      event.paymentFailed({ reason: "fail", message: unavailableMessage });
      onError(unavailableMessage);
      return;
    }
    onBusyChange(true);
    try {
      await onBeforeConfirm?.();
      const result = await checkoutState.checkout.confirm({
        redirect: "if_required",
        expressCheckoutConfirmEvent: event,
      });
      if (result.type === "error") {
        event.paymentFailed({ reason: "fail", message: result.error.message });
        onError(result.error.message);
        return;
      }
      onComplete(result.session.id);
    } catch {
      event.paymentFailed({ reason: "fail" });
      onError(unavailableMessage);
    } finally {
      onBusyChange(false);
    }
  };

  return (
    <div className={`purchase-apple-pay purchase-apple-pay-${availability}`} aria-label={ariaLabel} aria-hidden={availability !== "available"} data-wallet-state={availability}>
      {adaptive && availability === "available" ? <div className="purchase-wallet-pricing">
        {needsSelector ? <CurrencySelectorElement onReady={() => setCurrencyReady(true)} onLoadError={() => { setCurrencyFailed(true); setCurrencyReady(false); }} /> : null}
        {quoteReady ? <p className="purchase-wallet-total"><span>{getWalletTotalLabel(locale)}</span> <strong dir="ltr">{total.amount} {checkout.currency.toUpperCase()}</strong></p> : <p role="status">{currencyFailed ? unavailableMessage : getPackCopy(locale).loading}</p>}
      </div> : null}
      <ExpressCheckoutElement
        className={walletVisible ? undefined : "purchase-wallet-hidden"}
        options={{
          buttonHeight: 48,
          buttonType: { applePay: "buy" },
          buttonTheme: { applePay: "white-outline" },
          layout: { maxColumns: 1, maxRows: 1, overflow: "auto" },
          paymentMethodOrder: ["applePay"],
          paymentMethods: {
            applePay: "always",
            googlePay: "never",
            link: "never",
            paypal: "never",
            klarna: "never",
            amazonPay: "never",
          },
        }}
        onReady={({ availablePaymentMethods }) => {
          const applePay = mapApplePayAvailability(availablePaymentMethods?.applePay);
          reportDiagnostic({ stage: "express_ready", applePay });
          setAvailability(applePay === "available" ? "available" : "unavailable");
        }}
        onAvailablePaymentMethodsChange={({ paymentMethods }) => {
          const applePay = mapApplePayAvailability(paymentMethods?.applePay?.available);
          reportDiagnostic({ stage: "availability_change", applePay });
          setAvailability(applePay === "available" ? "available" : "unavailable");
        }}
        onLoadError={() => {
          reportDiagnostic({ stage: "element_load", outcome: "failure", reason: "load_error" });
          setAvailability("unavailable");
        }}
        onConfirm={handleConfirm}
        onCancel={() => onBusyChange(false)}
      />
    </div>
  );
}

export function ApplePayCheckout({ productId, expectedCredits, onBeforeConfirm, locale, ariaLabel, unavailableMessage, onComplete, onError, onBusyChange }: ApplePayCheckoutProps) {
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const stripePromise = useMemo(() => publishableKey ? loadStripe(publishableKey) : null, [publishableKey]);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  useEffect(() => {
    if (!publishableKey) {
      reportDiagnostic({ stage: "stripe_init", outcome: "failure", reason: "missing_key" });
      return;
    }
    if (!stripePromise) {
      reportDiagnostic({ stage: "stripe_init", outcome: "failure", reason: "null_stripe" });
      return;
    }
    void stripePromise
      .then((stripe) => {
        reportDiagnostic(
          stripe
            ? { stage: "stripe_init", outcome: "success", reason: "loaded" }
            : { stage: "stripe_init", outcome: "failure", reason: "null_stripe" },
        );
      })
      .catch(() => reportDiagnostic({ stage: "stripe_init", outcome: "failure", reason: "load_error" }));
  }, [publishableKey, stripePromise]);

  useEffect(() => {
    if (!stripePromise) return;
    let active = true;
    let failureReported = false;
    void fetch("/api/checkout/elements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale, ...(productId ? { productId, expectedCredits } : {}) }),
    })
      .then(async (response) => {
        if (!response.ok) {
          failureReported = true;
          reportDiagnostic({ stage: "session_init", outcome: "failure", reason: "http_error", status: mapApplePayHttpStatus(response.status) });
          throw new Error("checkout unavailable");
        }
        let body: unknown;
        try {
          body = await response.json();
        } catch {
          failureReported = true;
          reportDiagnostic({ stage: "session_init", outcome: "failure", reason: "invalid_response", status: "unknown" });
          throw new Error("checkout unavailable");
        }
        if (typeof body !== "object" || body === null || !("clientSecret" in body) || typeof body.clientSecret !== "string") {
          failureReported = true;
          reportDiagnostic({ stage: "session_init", outcome: "failure", reason: "invalid_response", status: "unknown" });
          throw new Error("checkout unavailable");
        }
        reportDiagnostic({ stage: "session_init", outcome: "success", status: "ok" });
        if (active) setClientSecret(body.clientSecret);
      })
      .catch(() => {
        // The explicit response failures above already reported their category.
        // A rejected fetch is the remaining network failure case.
        if (!failureReported) reportDiagnostic({ stage: "session_init", outcome: "failure", reason: "network_error", status: "unknown" });
        // Keep the hosted Checkout action usable when the wallet session cannot initialize.
        // Confirmation failures still surface through onError below.
      });
    return () => { active = false; };
  }, [locale, stripePromise, productId, expectedCredits]);

  if (!stripePromise || !clientSecret) return null;
  return (
    <CheckoutElementsProvider
      stripe={stripePromise}
      options={{
        clientSecret,
        adaptivePricing: { allowed: Boolean(productId) },
        elementsOptions: {
          loader: "auto",
          appearance: { variables: { fontFamily: locale === "ar" ? "Alexandria, sans-serif" : "IBM Plex Sans, sans-serif", colorPrimary: "#195c47", colorText: "#222222", borderRadius: "8px" } },
          fonts: [{ cssSrc: locale === "ar" ? "https://fonts.googleapis.com/css2?family=Alexandria:wght@400;600&display=swap" : "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600&display=swap" }],
        },
      }}
    >
      <ApplePayButton
        locale={locale}
        productId={productId}
        ariaLabel={ariaLabel}
        unavailableMessage={unavailableMessage}
        onComplete={onComplete}
        onError={onError}
        onBusyChange={onBusyChange}
        onBeforeConfirm={onBeforeConfirm}
      />
    </CheckoutElementsProvider>
  );
}
