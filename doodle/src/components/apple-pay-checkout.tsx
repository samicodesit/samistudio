"use client";

import { useEffect, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import type { StripeExpressCheckoutElementConfirmEvent } from "@stripe/stripe-js";
import {
  CheckoutElementsProvider,
  ExpressCheckoutElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";
import type { Locale } from "@/lib/i18n";
import {
  APPLE_PAY_DIAGNOSTIC_PATH,
  mapApplePayAvailability,
  mapApplePayHttpStatus,
  type ApplePayDiagnosticEvent,
} from "@/lib/billing/apple-pay-diagnostics";

interface ApplePayCheckoutProps {
  locale: Locale;
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

function ApplePayButton({ ariaLabel, unavailableMessage, onComplete, onError, onBusyChange }: Omit<ApplePayCheckoutProps, "locale">) {
  const checkoutState = useCheckoutElements();
  const [availability, setAvailability] = useState<"pending" | "available" | "unavailable">("pending");

  useEffect(() => {
    if (checkoutState.type === "loading") return;
    reportDiagnostic(checkoutState.type === "error"
      ? { stage: "provider", outcome: "failure", reason: "provider_error" }
      : { stage: "provider", outcome: "success", reason: "ready" });
  }, [checkoutState.type]);

  if (checkoutState.type === "loading") return null;
  if (checkoutState.type === "error") return null;

  const handleConfirm = async (event: StripeExpressCheckoutElementConfirmEvent) => {
    onBusyChange(true);
    try {
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
      <ExpressCheckoutElement
        options={{
          buttonHeight: 48,
          buttonType: { applePay: "buy" },
          buttonTheme: { applePay: "white-outline" },
          layout: { maxColumns: 1, maxRows: 1, overflow: "never" },
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

export function ApplePayCheckout({ locale, ariaLabel, unavailableMessage, onComplete, onError, onBusyChange }: ApplePayCheckoutProps) {
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
      body: JSON.stringify({ locale }),
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
  }, [locale, stripePromise]);

  if (!stripePromise || !clientSecret) return null;
  return (
    <CheckoutElementsProvider
      stripe={stripePromise}
      options={{
        clientSecret,
        elementsOptions: { loader: "auto" },
      }}
    >
      <ApplePayButton
        ariaLabel={ariaLabel}
        unavailableMessage={unavailableMessage}
        onComplete={onComplete}
        onError={onError}
        onBusyChange={onBusyChange}
      />
    </CheckoutElementsProvider>
  );
}
