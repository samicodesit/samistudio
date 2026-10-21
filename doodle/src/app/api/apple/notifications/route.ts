import { NextResponse } from "next/server";
import { getAppleBillingConfig } from "@/lib/billing/apple-config";
import { processAppleBillingNotification } from "@/lib/billing/apple-billing-notifications";
import { ApplePurchaseError } from "@/lib/billing/apple-purchase";
import { hasExactKeys, NativeRequestError, readNativeJson } from "@/lib/native-contracts";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
function json(body: unknown, status: number) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
export async function POST(request: Request) {
  let body;
  try { body = await readNativeJson(request, 70_000); }
  catch (error) { const oversized = error instanceof NativeRequestError && error.code === "body_too_large"; return json({ error: oversized ? "request_too_large" : "invalid_request" }, oversized ? 413 : 400); }
  if (!hasExactKeys(body, ["signedPayload"]) || typeof body.signedPayload !== "string") return json({ error: "invalid_request" }, 400);
  try {
    const config = getAppleBillingConfig();
    if (!config) return json({ error: "apple_unavailable" }, 503);
    return json(await processAppleBillingNotification(config, body.signedPayload), 200);
  } catch (error) { const invalid = error instanceof ApplePurchaseError && error.kind === "invalid"; return json({ error: invalid ? "invalid_notification" : "notification_unavailable" }, invalid ? 401 : 503); }
}
