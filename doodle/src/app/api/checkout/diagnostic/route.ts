import { hasSameOrigin } from "@/lib/auth/same-origin";
import { getCurrentUser } from "@/lib/auth/session";
import { isApplePayDiagnosticEvent } from "@/lib/billing/apple-pay-diagnostics";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 512;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_EVENTS_PER_ACCOUNT = 24;
const MAX_TRACKED_ACCOUNTS = 1024;

const eventBudget = new Map<string, { startedAt: number; count: number }>();

function hasBudget(accountId: string) {
  const now = Date.now();
  const existing = eventBudget.get(accountId);
  if (!existing || now - existing.startedAt >= WINDOW_MS) {
    if (eventBudget.size >= MAX_TRACKED_ACCOUNTS && !existing) {
      const oldest = eventBudget.keys().next().value;
      if (oldest) eventBudget.delete(oldest);
    }
    eventBudget.set(accountId, { startedAt: now, count: 1 });
    return true;
  }
  if (existing.count >= MAX_EVENTS_PER_ACCOUNT) return false;
  existing.count += 1;
  return true;
}

function response(status: number) {
  return new NextResponse(null, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) return response(403);

  const user = await getCurrentUser();
  if (!user) return response(401);

  const contentLength = request.headers.get("content-length");
  if (contentLength && Number.isSafeInteger(Number(contentLength)) && Number(contentLength) > MAX_BODY_BYTES) {
    return response(413);
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return response(400);
  }
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) return response(413);

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return response(400);
  }
  if (!isApplePayDiagnosticEvent(body)) return response(400);

  if (hasBudget(user.id)) {
    console.info("[apple-pay-diagnostic]", JSON.stringify(body));
  }
  return response(204);
}
