import "server-only";

import Stripe from "stripe";
import { required } from "@/lib/supabase/env";

let client: Stripe | undefined;

export function getStripe() {
  return (client ??= new Stripe(required("STRIPE_SECRET_KEY"), {
    apiVersion: "2026-07-29.dahlia",
  }));
}
