import type { NativeDoodleUiCopy, NativePurchaseUi } from "../ui/types";

function textOrFallback(value: string | undefined, fallback: string): string {
  return value?.trim() ? value : fallback;
}

export function purchaseBody(copy: NativeDoodleUiCopy): string {
  return `${copy.purchase.reassurance} ${copy.purchase.failedDontCount}`;
}

export function makePurchaseUi(copy: NativeDoodleUiCopy, mode: NativePurchaseUi["mode"], overrides: Partial<NativePurchaseUi> = {}): NativePurchaseUi {
  const isSignIn = mode === "signIn";
  const isSuccess = mode === "success";
  return {
    visible: true,
    mode,
    title: textOrFallback(overrides.title, copy.purchase.title),
    body: textOrFallback(overrides.body, isSignIn ? copy.auth.signIn : isSuccess ? copy.purchase.added : purchaseBody(copy)),
    quantityLabel: textOrFallback(overrides.quantityLabel, copy.purchase.quantity),
    priceLabel: overrides.priceLabel,
    termsLabel: textOrFallback(overrides.termsLabel, copy.purchase.reassurance),
    failedGenerationsLabel: textOrFallback(overrides.failedGenerationsLabel, copy.purchase.failedDontCount),
    buyLabel: textOrFallback(overrides.buyLabel, copy.purchase.buy),
    signInLabel: textOrFallback(overrides.signInLabel, copy.auth.google),
    cancelLabel: textOrFallback(overrides.cancelLabel, copy.purchase.cancel),
    restoreLabel: overrides.restoreLabel === "" ? undefined : textOrFallback(overrides.restoreLabel, copy.purchase.restore),
    errorLabel: mode === "error" ? textOrFallback(overrides.errorLabel, copy.purchase.checkoutError) : overrides.errorLabel,
    busy: overrides.busy ?? mode === "checkout",
  };
}
