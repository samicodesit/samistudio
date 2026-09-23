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

interface ApplePayCheckoutProps {
  locale: Locale;
  ariaLabel: string;
  unavailableMessage: string;
  onComplete: (sessionId: string) => void;
  onError: (message: string) => void;
  onBusyChange: (busy: boolean) => void;
}

function ApplePayButton({ ariaLabel, unavailableMessage, onComplete, onError, onBusyChange }: Omit<ApplePayCheckoutProps, "locale">) {
  const checkoutState = useCheckoutElements();
  const [available, setAvailable] = useState(false);

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
    <div className="purchase-apple-pay" hidden={!available} aria-label={ariaLabel}>
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
        onAvailablePaymentMethodsChange={({ paymentMethods }) => setAvailable(paymentMethods?.applePay?.available === true)}
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
    if (!stripePromise) return;
    let active = true;
    void fetch("/api/checkout/elements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    })
      .then(async (response) => {
        const body = await response.json() as { clientSecret?: unknown };
        if (!response.ok || typeof body.clientSecret !== "string") throw new Error("checkout unavailable");
        if (active) setClientSecret(body.clientSecret);
      })
      .catch(() => {
        // Keep the hosted Checkout action usable when the wallet session cannot initialize.
        // Confirmation failures still surface through onError below.
      });
    return () => { active = false; };
  }, [locale, onError, stripePromise, unavailableMessage]);

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
