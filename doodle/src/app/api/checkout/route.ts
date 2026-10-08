import { diagnoseRequest, type RequestDiagnostics } from "@/lib/diagnostics/request";
import { hasSameOrigin } from "@/lib/auth/same-origin";
import { createPackCheckout } from "@/lib/billing/checkout";
import { hasLocale } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth/session";
import { checkBotId } from "botid/server";
import { NextRequest, NextResponse } from "next/server";
import { trackOperation } from "@/lib/usage-metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handlePOST(request: NextRequest, diagnostics: RequestDiagnostics) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if ((await checkBotId()).isBot) {
    return NextResponse.json({ error: "bot_detected" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_locale" }, { status: 400 });
  }
  const locale =
    typeof body === "object" && body !== null && "locale" in body
      ? body.locale
      : undefined;
  if (typeof locale !== "string" || !hasLocale(locale)) {
    return NextResponse.json({ error: "invalid_locale" }, { status: 400 });
  }

  diagnostics.stage = "session_read";
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    diagnostics.stage = "billing_prepare";
    const checkout = await createPackCheckout({
      userId: user.id,
      email: user.email,
      locale,
      origin: request.nextUrl.origin,
    });
    trackOperation({ metric: "checkout", channel: "web", outcome: checkout.url ? "created" : "error", actor: `account:${user.id}`, email: user.email });
    return checkout.url
      ? NextResponse.json({ url: checkout.url })
      : NextResponse.json({ error: "billing_unavailable" }, { status: 503 });
  } catch {
    trackOperation({ metric: "checkout", channel: "web", outcome: "error", actor: `account:${user.id}`, email: user.email });
    return NextResponse.json({ error: "billing_unavailable" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  return diagnoseRequest(request, "billing", (diagnostics) => handlePOST(request, diagnostics));
}
