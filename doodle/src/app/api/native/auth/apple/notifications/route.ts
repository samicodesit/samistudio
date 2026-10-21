import { AppleNotificationError, verifyAppleNotification } from "@/lib/auth/apple";
import { processAppleNotification } from "@/lib/auth/apple-notifications";
import { hasExactKeys, NativeRequestError, readNativeJson } from "@/lib/native-contracts";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function reply(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await readNativeJson(request, 16_384); }
  catch (failure) {
    const oversized = failure instanceof NativeRequestError && failure.code === "body_too_large";
    return reply({ error: oversized ? "request_too_large" : "invalid_request" }, oversized ? 413 : 400);
  }
  if (!hasExactKeys(body, ["payload"]) || typeof body.payload !== "string" || !body.payload || body.payload.length > 12_000) {
    return reply({ error: "invalid_request" }, 400);
  }
  try {
    const notification = await verifyAppleNotification(body.payload);
    await processAppleNotification(notification);
    return reply({ received: true }, 200);
  } catch (failure) {
    const invalid = failure instanceof AppleNotificationError && failure.kind === "invalid";
    return reply({ error: invalid ? "invalid_notification" : "notification_unavailable" }, invalid ? 401 : 503);
  }
}
