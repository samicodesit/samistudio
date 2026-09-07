import "server-only";

import { claimPlayCredits, getPlayCreditClaim, markPlayPurchaseConsumed } from "./play-credits";

export type ProductPurchaseV2 = {
  purchaseStateContext?: { purchaseState?: string };
  obfuscatedExternalAccountId?: string;
  productLineItem?: Array<{
    productId?: string;
    productOfferDetails?: {
      quantity?: number;
      refundableQuantity?: number;
      consumptionState?: string;
      rentOfferDetails?: unknown;
      preorderOfferDetails?: unknown;
    };
  }>;
};

export interface PlayPublisherClient {
  getProductPurchase(purchaseToken: string): Promise<ProductPurchaseV2>;
  consumeProductPurchase(productId: string, purchaseToken: string): Promise<void>;
}

export type PlayPurchaseResult = {
  status: "granted" | "already_granted" | "granted_consume_pending";
  balance: number;
};

export class PlayPurchaseError extends Error {
  constructor(readonly kind: "pending" | "invalid" | "foreign" | "unavailable") {
    super(kind);
    this.name = "PlayPurchaseError";
  }
}

export async function processPlayPurchase(input: {
  accountId: string;
  expectedObfuscatedAccountId: string;
  purchaseToken: string;
  productId: string;
  publisher: PlayPublisherClient;
}): Promise<PlayPurchaseResult> {
  let purchase: ProductPurchaseV2;
  try {
    purchase = await input.publisher.getProductPurchase(input.purchaseToken);
  } catch (error) {
    const status = typeof error === "object" && error !== null && "response" in error
      ? (error as { response?: { status?: unknown } }).response?.status
      : undefined;
    throw new PlayPurchaseError(status === 400 || status === 404 ? "invalid" : "unavailable");
  }

  const purchaseState = purchase.purchaseStateContext?.purchaseState;
  if (purchaseState === "PENDING") throw new PlayPurchaseError("pending");
  if (purchaseState !== "PURCHASED") throw new PlayPurchaseError("invalid");
  if (purchase.obfuscatedExternalAccountId !== input.expectedObfuscatedAccountId) {
    throw new PlayPurchaseError("foreign");
  }
  const lines = purchase.productLineItem;
  if (!lines || lines.length !== 1) throw new PlayPurchaseError("invalid");
  const line = lines[0];
  const offer = line.productOfferDetails;
  if (
    line.productId !== input.productId ||
    !offer ||
    offer.quantity !== 1 ||
    offer.refundableQuantity !== 1 ||
    offer.rentOfferDetails !== undefined ||
    offer.preorderOfferDetails !== undefined
  ) throw new PlayPurchaseError("invalid");

  if (offer.consumptionState === "CONSUMPTION_STATE_CONSUMED") {
    try {
      const claim = await getPlayCreditClaim(input.accountId, input.purchaseToken);
      if (claim.state !== "consumed") {
        try { await markPlayPurchaseConsumed(input.accountId, input.purchaseToken); } catch {}
      }
      return { status: "already_granted", balance: claim.balance };
    } catch (error) {
      if (error instanceof Error && error.message.includes("another account")) throw new PlayPurchaseError("foreign");
      throw new PlayPurchaseError("invalid");
    }
  }
  if (offer.consumptionState !== "CONSUMPTION_STATE_YET_TO_BE_CONSUMED") {
    throw new PlayPurchaseError("invalid");
  }

  let claim;
  try {
    claim = await claimPlayCredits(input.accountId, input.purchaseToken);
  } catch (error) {
    if (error instanceof Error && error.message.includes("another account")) throw new PlayPurchaseError("foreign");
    throw new PlayPurchaseError("unavailable");
  }

  try {
    await input.publisher.consumeProductPurchase(input.productId, input.purchaseToken);
    await markPlayPurchaseConsumed(input.accountId, input.purchaseToken);
  } catch {
    return { status: "granted_consume_pending", balance: claim.balance };
  }
  return { status: claim.granted ? "granted" : "already_granted", balance: claim.balance };
}
