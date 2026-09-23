import "server-only";

export type CheckoutTaxMode = "automatic" | "disabled";

export type StripeCheckoutConfig = {
  taxMode: CheckoutTaxMode;
  automaticTaxEnabled: boolean;
};

/**
 * Paid web checkout is opt-in. A tax mode is also required so that enabling
 * checkout cannot silently choose a tax treatment from a missing variable.
 */
export function getStripeCheckoutConfig(): StripeCheckoutConfig | null {
  if (process.env.STRIPE_CHECKOUT_ENABLED !== "true") return null;

  const taxMode = process.env.STRIPE_CHECKOUT_TAX_MODE;
  if (taxMode !== "automatic" && taxMode !== "disabled") return null;

  if (taxMode === "automatic" && process.env.STRIPE_TAX_REGISTRATION_CONFIRMED !== "true") return null;

  return {
    taxMode,
    automaticTaxEnabled: taxMode === "automatic",
  };
}
