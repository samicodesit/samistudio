import { fulfillCheckout } from "@/lib/billing/checkout";
import { getStripe } from "@/lib/billing/stripe";
import { required } from "@/lib/supabase/env";
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
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    try {
      await fulfillCheckout(event.data.object.id);
    } catch {
      return NextResponse.json({ error: "fulfillment_failed" }, { status: 500 });
    }
  }

  return new Response(null, { status: 200 });
}
