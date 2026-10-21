import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasSameOrigin } from "@/lib/auth/same-origin";
import { hasExactKeys, NativeRequestError, readNativeJson } from "@/lib/native-contracts";
import { getAppleBillingConfig } from "@/lib/billing/apple-config";
import { createAppleIntent } from "@/lib/billing/apple-credits";
import { PLAY_PACK_IDS, type PlayPackId } from "@/lib/billing/play-catalog";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
function json(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return json({ error: "forbidden" }, 403);
  const user = await getCurrentUser(request).catch(() => null);
  if (!user) return json({ error: "unauthorized" }, 401);
  let body;
  try { body = await readNativeJson(request, 1024); }
  catch (error) { return json({ error: error instanceof NativeRequestError && error.code === "body_too_large" ? "request_too_large" : "invalid_request" }, error instanceof NativeRequestError && error.code === "body_too_large" ? 413 : 400); }
  if (!hasExactKeys(body, ["productId", "expectedCredits"]) || !PLAY_PACK_IDS.includes(body.productId as PlayPackId) || !Number.isSafeInteger(body.expectedCredits)) return json({ error: "invalid_request" }, 400);
  try {
    const config = getAppleBillingConfig();
    if (!config) return json({ error: "apple_unavailable" }, 503);
    return json(await createAppleIntent(user.id, body.productId as PlayPackId, body.expectedCredits as number, config.environment, new Date(), true));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return json({ error: message === "offer_changed" ? "offer_changed" : message === "rate_limited" ? "rate_limited" : "apple_unavailable" }, message === "offer_changed" ? 409 : message === "rate_limited" ? 429 : 503);
  }
}
