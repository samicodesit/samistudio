import "server-only";

import { fillPackText, getPackCopy } from "../pack-copy";
import type Stripe from "stripe";
import type { Locale } from "@/lib/i18n";
import { localePath } from "@/lib/i18n";
import { required } from "@/lib/env";
import { fulfillCreditPack, getPaidBalance } from "./credits";
import { getStripe } from "./stripe";
import { createWebPackPromise, readWebPackPromise } from "./web-packs";
import { fulfillStripePack, readStripeGrant, refundStripePack, type WebPackGrant } from "./web-pack-ledger";
import { PLAY_PACK_IDS, type PlayPackId } from "./play-catalog";

export type CheckoutInput = { userId: string; email: string | null; locale: Locale; origin: string; productId?: PlayPackId; expectedCredits?: number };

const PACK = "doodle_10";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function stripeLocale(locale: Locale): Stripe.Checkout.SessionCreateParams.Locale {
  if (locale === "ar") return "auto";
  if (locale === "pt-br") return "pt-BR";
  return locale;
}

async function createPackSession({ userId, email, locale, origin, productId, expectedCredits }: CheckoutInput, presentation: "hosted" | "elements") {
  const path = localePath(locale);
  const promise = productId ? await createWebPackPromise(userId, productId, expectedCredits ?? -1) : null;
  const metadata: Stripe.MetadataParam = promise ? { userId, pack: promise.productId, checkoutRef: promise.reference } : { userId, pack: PACK };
  const common = {
    mode: "payment",
    line_items: [{ price: promise?.priceId ?? required("STRIPE_DOODLE_PRICE_ID"), quantity: 1 }],
    automatic_tax: { enabled: true },
    adaptive_pricing: { enabled: promise !== null },
    allow_promotion_codes: true,
    client_reference_id: userId,
    customer_email: email ?? undefined,
    metadata,
    locale: stripeLocale(locale),
    ...(promise ? {payment_intent_data:{metadata:{app:"doodle",pack:promise.productId,checkoutRef:promise.reference}}} : {}),
  } satisfies Pick<Stripe.Checkout.SessionCreateParams, "mode" | "line_items" | "automatic_tax" | "adaptive_pricing" | "allow_promotion_codes" | "client_reference_id" | "customer_email" | "metadata" | "locale">;

  if (presentation === "elements") {
    return getStripe().checkout.sessions.create({
      ...common,
      ...(promise ? { expires_at: Math.floor(Date.now()/1000)+1860 } : {}),
      ui_mode: "elements",
      return_url: `${origin}${path}?checkout={CHECKOUT_SESSION_ID}`,
    });
  }

  return getStripe().checkout.sessions.create({
    ...common,
    ...(promise ? {custom_text:{submit:{message:fillPackText(getPackCopy(locale).quantity,{count:promise.credits})+". "+getPackCopy(locale).neverExpire+" "+getPackCopy(locale).failedFree}}} : {}),
    ...(promise ? { expires_at: Math.floor(Date.now()/1000)+1860 } : {}),
    branding_settings: {
      display_name: "Doodle",
      background_color: "#fcfcf8",
      button_color: "#195c47",
      border_style: "rounded",
      font_family: "inter",
      icon: { type: "url", url: `${origin}/references/doodle-reference-kiss.png` },
    },
    success_url: `${origin}${path}?checkout={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${path}?checkout=cancelled`,
  });
}

export function createPackCheckout(input: CheckoutInput) {
  return createPackSession(input, "hosted");
}

export function createPackElementsCheckout(input: CheckoutInput) {
  return createPackSession(input, "elements");
}

// Payment failures are terminal only when Stripe confirms the state. A network
// failure or an unpaid processing payment must keep its checkout ownership.
async function requireCompletedPayment(session: Stripe.Checkout.Session): Promise<void> {
  if (session.status === "expired") throw new Error("checkout_failed");
  if (session.payment_status === "unpaid") {
    if (typeof session.payment_intent === "string") {
      const payment = await getStripe().paymentIntents.retrieve(session.payment_intent);
      if (payment.status === "canceled" || (session.status === "complete" && payment.status === "requires_payment_method")) throw new Error("checkout_failed");
    }
    throw new Error("checkout_pending");
  }
  if (session.payment_status !== "paid") throw new Error("Invalid pack checkout");
}

export async function fulfillCheckoutDetails(sessionId: string, expectedUserId?: string): Promise<WebPackGrant> {
  const session = await getStripe().checkout.sessions.retrieve(sessionId, { expand: ["line_items"] });
  const userId = session.metadata?.userId;
  const lineItems = session.line_items?.data;

  if (PLAY_PACK_IDS.includes(session.metadata?.pack as PlayPackId)) {
    if (session.mode !== "payment" || !userId || !UUID_PATTERN.test(userId) || (expectedUserId && userId !== expectedUserId) || session.client_reference_id !== userId || session.line_items?.has_more !== false || lineItems?.length !== 1 || lineItems[0]?.quantity !== 1 || !session.metadata?.checkoutRef) throw new Error("Invalid pack checkout");
    await requireCompletedPayment(session);
    if (typeof session.payment_intent !== "string") throw new Error("Invalid pack checkout");
    const grant = await readStripeGrant(userId,sessionId) ?? await readWebPackPromise(userId,session.metadata.pack,session.metadata.checkoutRef);
    if (grant.productId !== session.metadata.pack || grant.reference !== session.metadata.checkoutRef || lineItems[0].price?.id !== grant.priceId) throw new Error("Invalid pack checkout");
    // A refunded purchase recovered before its webhook must never make refunded credits spendable.
    const payment=await getStripe().paymentIntents.retrieve(session.payment_intent,{expand:["latest_charge"]});
    const charge=payment.latest_charge;
    if(payment.status!=="succeeded" || !charge || typeof charge==="string" || charge.payment_intent!==session.payment_intent || charge.metadata.pack!==grant.productId || charge.metadata.checkoutRef!==grant.reference || charge.currency!=="eur" || charge.amount!==session.amount_total || !Number.isSafeInteger(charge.amount) || charge.amount<=0 || !Number.isSafeInteger(charge.amount_refunded) || charge.amount_refunded<0 || charge.amount_refunded>charge.amount)throw new Error("Invalid paid charge");
    const refunded=Math.floor(grant.credits*charge.amount_refunded/charge.amount);
    const result=await fulfillStripePack(userId,sessionId,session.payment_intent,grant,{isTest:session.livemode !== true || !(typeof session.amount_total === "number" && session.amount_total > 0),email:session.customer_details?.email ?? session.customer_email},refunded);
    if(refunded>0){await refundStripePack(sessionId,refunded);result.balance=await getPaidBalance(userId);}
    return result;
  }

  if (
    session.metadata?.pack !== PACK ||
    !userId ||
    !UUID_PATTERN.test(userId) ||
    (expectedUserId !== undefined && userId !== expectedUserId) ||
    session.line_items?.has_more !== false ||
    lineItems?.length !== 1 ||
    lineItems[0]?.price?.id !== required("STRIPE_DOODLE_PRICE_ID") ||
    lineItems[0]?.quantity !== 1
  ) {
    throw new Error("Checkout session does not match the fixed credit pack");
  }

  await requireCompletedPayment(session);
  if (typeof session.payment_intent !== "string") throw new Error("Checkout session does not match the fixed credit pack");
  const balance = await fulfillCreditPack(userId, sessionId, session.payment_intent, {
    isTest: session.livemode !== true || !(typeof session.amount_total === "number" && session.amount_total > 0),
    email: session.customer_details?.email ?? session.customer_email,
  });
  return {balance, productId:PACK, creditsGranted:10, offerApplied:false};
}
export async function fulfillCheckout(sessionId: string, expectedUserId?: string): Promise<number> {
  return (await fulfillCheckoutDetails(sessionId, expectedUserId)).balance;
}
export async function reconcileStripePackRefund(chargeId: string) {
  const stripe=getStripe(), charge=await stripe.charges.retrieve(chargeId);
  if (!PLAY_PACK_IDS.includes(charge.metadata?.pack as PlayPackId)) return;
  if (typeof charge.payment_intent !== "string" || !Number.isSafeInteger(charge.amount) || charge.amount <= 0 || !Number.isSafeInteger(charge.amount_refunded) || charge.amount_refunded < 0 || charge.amount_refunded > charge.amount) throw new Error("Invalid refunded charge");
  const sessions=await stripe.checkout.sessions.list({payment_intent:charge.payment_intent,limit:2});
  if (sessions.data.length !== 1 || sessions.has_more) throw new Error("Invalid refund checkout");
  const session=sessions.data[0];
  if (!PLAY_PACK_IDS.includes(session.metadata?.pack as PlayPackId)) return;
  const userId=session.metadata?.userId;
  if (!userId || !UUID_PATTERN.test(userId)) throw new Error("Invalid refund owner");
  if (charge.metadata.pack !== session.metadata?.pack || charge.metadata.checkoutRef !== session.metadata?.checkoutRef || session.payment_intent !== charge.payment_intent) throw new Error("Invalid refund binding");
  let grant=await readStripeGrant(userId,session.id);
  if (!grant) { await fulfillCheckoutDetails(session.id); grant=await readStripeGrant(userId,session.id); }
  if (!grant) throw new Error("Invalid refund receipt");
  return refundStripePack(session.id,Math.floor(grant.credits*charge.amount_refunded/charge.amount));
}
