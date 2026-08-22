import "server-only";

import type Stripe from "stripe";
import type { Locale } from "@/lib/i18n";
import { localePath } from "@/lib/i18n";
import { required } from "@/lib/supabase/env";
import { fulfillCreditPack } from "./credits";
import { getStripe } from "./stripe";

export const PACK_CREDITS = 10;
export const PACK_PRICE = "€4.99";
export type CheckoutInput = { userId: string; email: string | null; locale: Locale; origin: string };

const PACK = "doodle_10";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function stripeLocale(locale: Locale): Stripe.Checkout.SessionCreateParams.Locale {
  if (locale === "ar") return "auto";
  if (locale === "pt-br") return "pt-BR";
  return locale;
}

export function createPackCheckout({ userId, email, locale, origin }: CheckoutInput) {
  const path = localePath(locale);
  return getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: required("STRIPE_DOODLE_PRICE_ID"), quantity: 1 }],
    automatic_tax: { enabled: true },
    adaptive_pricing: { enabled: false },
    allow_promotion_codes: false,
    client_reference_id: userId,
    customer_email: email ?? undefined,
    metadata: { userId, pack: PACK },
    locale: stripeLocale(locale),
    success_url: `${origin}${path}?checkout={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${path}?checkout=cancelled`,
  });
}

export async function fulfillCheckout(sessionId: string, expectedUserId?: string): Promise<number> {
  const session = await getStripe().checkout.sessions.retrieve(sessionId, { expand: ["line_items"] });
  const userId = session.metadata?.userId;
  const lineItems = session.line_items?.data;

  if (
    session.payment_status !== "paid" ||
    session.metadata?.pack !== PACK ||
    !userId ||
    !UUID_PATTERN.test(userId) ||
    (expectedUserId !== undefined && userId !== expectedUserId) ||
    session.line_items?.has_more !== false ||
    lineItems?.length !== 1 ||
    lineItems[0]?.price?.id !== required("STRIPE_DOODLE_PRICE_ID") ||
    lineItems[0]?.quantity !== 1 ||
    typeof session.payment_intent !== "string"
  ) {
    throw new Error("Checkout session does not match the fixed credit pack");
  }

  return fulfillCreditPack(userId, sessionId, session.payment_intent);
}
