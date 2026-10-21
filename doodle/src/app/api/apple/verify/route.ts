import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasSameOrigin } from "@/lib/auth/same-origin";
import { hasExactKeys, NativeRequestError, readNativeJson } from "@/lib/native-contracts";
import { getAppleBillingConfig } from "@/lib/billing/apple-config";
import { AppleLedgerError, claimAppleCredits } from "@/lib/billing/apple-credits";
import { ApplePurchaseError, createApplePurchaseLookup } from "@/lib/billing/apple-purchase";
import { trackUsage } from "@/lib/usage-metrics";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
function json(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return json({ error: "forbidden" }, 403);
  const user = await getCurrentUser(request).catch(() => null);
  if (!user) return json({ error: "unauthorized" }, 401);
  let body;
  try { body = await readNativeJson(request, 4096); }
  catch (error) { return json({ error: error instanceof NativeRequestError && error.code === "body_too_large" ? "request_too_large" : "invalid_request" }, error instanceof NativeRequestError && error.code === "body_too_large" ? 413 : 400); }
  if (!hasExactKeys(body, ["transactionId"]) || typeof body.transactionId !== "string" || !/^\d{1,32}$/.test(body.transactionId)) return json({ error: "invalid_request" }, 400);
  try {
    const config = getAppleBillingConfig();
    if (!config) return json({ error: "apple_unavailable" }, 503);
    const transaction = await createApplePurchaseLookup(config)(body.transactionId);
    const result = await claimAppleCredits(user.id, transaction);
    trackUsage({ metric: "purchases", channel: "ios", id: `apple:${transaction.environment}:${transaction.transactionId}`,
      actor: `account:${user.id}`, email: user.email, isTest: transaction.environment === "Sandbox" });
    return json({ ...result, productId: transaction.productId, checkoutReference: transaction.appAccountToken });
  } catch (error) {
    if (error instanceof ApplePurchaseError && error.kind === "invalid") return json({ error: "invalid_purchase" }, 400);
    if (error instanceof AppleLedgerError && error.kind !== "unavailable") return json({ error: "purchase_rejected" }, 409);
    return json({ error: "apple_unavailable" }, 503);
  }
}
