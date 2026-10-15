import "server-only";

import { claimPlayCredits, getPlayCreditClaim, markPlayPurchaseConsumed, getPlayGrant } from "./play-credits";
import { readPlayIntent, type PlayGrant } from "./play-intents";
import { isPlayProductId, LEGACY_PLAY_PRODUCT } from "./play-catalog";
import { trackFunnel } from "../funnel-metrics";
import { trackUsage } from "../usage-metrics";
import { notifyOwnerSale } from "./sale-notification";

export type ProductPurchaseV2 = {
  testPurchaseContext?: { fopType?: string };
  purchaseStateContext?: { purchaseState?: string };
  obfuscatedExternalAccountId?: string;
  obfuscatedExternalProfileId?: string;
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
  productId?: string;
  creditsGranted?: number;
  offerApplied?: boolean;
  checkoutReference?: string;
};

export class PlayPurchaseError extends Error {
  constructor(readonly kind: "pending" | "invalid" | "foreign" | "unavailable") {
    super(kind);
    this.name = "PlayPurchaseError";
  }
}

export async function processPlayPurchase(input: {
  accountId: string;
  email?: string | null;
  expectedObfuscatedAccountId: string;
  purchaseToken: string;
  productId: string;
  publisher: PlayPublisherClient;
}): Promise<PlayPurchaseResult> {
  if (!isPlayProductId(input.productId)) throw new PlayPurchaseError("invalid");
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

  const metadata = async () => {
    if (input.productId === LEGACY_PLAY_PRODUCT) return {};
    const recorded = await getPlayGrant(input.accountId,input.purchaseToken);
    if (recorded.productId !== input.productId) throw new PlayPurchaseError("invalid");
    return {productId:recorded.productId,creditsGranted:recorded.credits,offerApplied:recorded.offerApplied,checkoutReference:purchase.obfuscatedExternalProfileId};
  };
  if (offer.consumptionState === "CONSUMPTION_STATE_CONSUMED") {
    try {
      const claim = await getPlayCreditClaim(input.accountId, input.purchaseToken);
      notifyOwnerSale({ channel: "android", id: input.purchaseToken, isTest: purchase.testPurchaseContext !== undefined, creditsGranted: (await metadata()).creditsGranted });
      if (claim.state !== "consumed") {
        try { await markPlayPurchaseConsumed(input.accountId, input.purchaseToken); } catch {}
      }
      return { status: "already_granted", balance: claim.balance, ...await metadata() };
    } catch (error) {
      if (error instanceof Error && error.message.includes("another account")) throw new PlayPurchaseError("foreign");
      throw new PlayPurchaseError("invalid");
    }
  }
  if (offer.consumptionState !== "CONSUMPTION_STATE_YET_TO_BE_CONSUMED") {
    throw new PlayPurchaseError("invalid");
  }

  let grant: PlayGrant | undefined;
  if (input.productId !== LEGACY_PLAY_PRODUCT) {
    try { grant=await readPlayIntent(input.accountId,input.productId,purchase.obfuscatedExternalProfileId ?? ""); }
    catch {throw new PlayPurchaseError("invalid");}
  }
  let claim;
  try {
    claim = grant ? await claimPlayCredits(input.accountId,input.purchaseToken,grant) : await claimPlayCredits(input.accountId, input.purchaseToken);
  } catch (error) {
    if (error instanceof Error && error.message.includes("another account")) throw new PlayPurchaseError("foreign");
    if (error instanceof Error && error.message.includes("checkout intent")) throw new PlayPurchaseError("invalid");
    throw new PlayPurchaseError("unavailable");
  }

  if (claim.granted) trackUsage({
    metric: "purchases", channel: "android", id: input.purchaseToken,
    actor: `account:${input.accountId}`, email: input.email,
    isTest: purchase.testPurchaseContext !== undefined,
  });
  if (claim.granted) trackFunnel({metric:"purchase",actor:"account:"+input.accountId,email:input.email,id:input.purchaseToken,pack:input.productId,creditsGranted:grant?.credits??10,offerApplied:grant?.offerApplied??false,isTest:purchase.testPurchaseContext!==undefined});
  notifyOwnerSale({ channel: "android", id: input.purchaseToken, isTest: purchase.testPurchaseContext !== undefined, creditsGranted: grant?.credits ?? 10 });

  try {
    await input.publisher.consumeProductPurchase(input.productId, input.purchaseToken);
    await markPlayPurchaseConsumed(input.accountId, input.purchaseToken);
  } catch {
    return { status: "granted_consume_pending", balance: claim.balance, ...await metadata() };
  }
  return { status: claim.granted ? "granted" : "already_granted", balance: claim.balance, ...await metadata() };
}
