import "server-only";

import { getAdminSupabase } from "@/lib/supabase/admin";

export type CreditReservation = { reserved: boolean; remaining: number };
export type CreditFinalization = { finalized: boolean; remaining: number };

function balance(value: unknown) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("Supabase returned an invalid credit balance");
  }
  return value;
}

function commandResult(value: unknown) {
  const result = balance(value);
  if (result !== 0 && result !== 1) throw new Error("Supabase returned an invalid command result");
  return result;
}

export async function getPaidBalance(userId: string): Promise<number> {
  const { data, error } = await getAdminSupabase()
    .from("credit_balances")
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data === null ? 0 : balance(data.balance);
}

export async function reservePaidCredit(userId: string, reservationId: string): Promise<CreditReservation> {
  const { data, error } = await getAdminSupabase().rpc("reserve_paid_credit", {
    p_user_id: userId,
    p_reservation_id: reservationId,
  });
  if (error) throw error;
  return data === -1 ? { reserved: false, remaining: 0 } : { reserved: true, remaining: balance(data) };
}

export async function finalizePaidCredit(userId: string, reservationId: string): Promise<CreditFinalization> {
  const { data, error } = await getAdminSupabase().rpc("finalize_paid_credit", {
    p_user_id: userId,
    p_reservation_id: reservationId,
  });
  if (error) throw error;
  return data === -1 ? { finalized: false, remaining: 0 } : { finalized: true, remaining: balance(data) };
}

export async function releasePaidCredit(userId: string, reservationId: string): Promise<number> {
  const { data, error } = await getAdminSupabase().rpc("release_paid_credit", {
    p_user_id: userId,
    p_reservation_id: reservationId,
  });
  if (error) throw error;
  return commandResult(data);
}

export async function fulfillCreditPack(
  userId: string,
  checkoutSessionId: string,
  paymentIntentId: string,
): Promise<number> {
  const { data, error } = await getAdminSupabase().rpc("fulfill_credit_pack", {
    p_user_id: userId,
    p_checkout_session_id: checkoutSessionId,
    p_payment_intent_id: paymentIntentId,
  });
  if (error) throw error;
  return balance(data);
}
