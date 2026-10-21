import { PLAY_PACK_IDS, type PlayPackId } from "@/lib/billing/play-catalog";
import { fulfillCheckout, reconcileStripePackRefund } from "@/lib/billing/checkout";
import { getStripe } from "@/lib/billing/stripe";
import { required } from "@/lib/env";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  let secret: string;
  let stripe: ReturnType<typeof getStripe>;
  try {
    secret = required("STRIPE_WEBHOOK_SECRET");
    stripe = getStripe();
  } catch {
    return NextResponse.json({ error: "webhook_unavailable" }, { status: 500 });
  }

  const rawBody = await request.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  if (
    (event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded") &&
    (event.data.object.metadata?.pack === "doodle_10" || PLAY_PACK_IDS.includes(event.data.object.metadata?.pack as PlayPackId))
  ) {
    try {
      // Pending payments are fulfilled only after Stripe confirms payment.
      if (event.data.object.payment_status === "unpaid") return new Response(null, {status:200});
      await fulfillCheckout(event.data.object.id);
    } catch {
      return NextResponse.json({ error: "fulfillment_failed" }, { status: 500 });
    }
  }

  if (event.type === "charge.refunded" && PLAY_PACK_IDS.includes(event.data.object.metadata?.pack as PlayPackId)) {
    try { await reconcileStripePackRefund(event.data.object.id); }
    catch { return NextResponse.json({error:"refund_reconciliation_failed"},{status:500}); }
  }
  return new Response(null, { status: 200 });
}
