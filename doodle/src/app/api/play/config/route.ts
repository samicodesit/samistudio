import { diagnoseRequest, type RequestDiagnostics } from "@/lib/diagnostics/request";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getPlayBillingConfig, playAccountId } from "@/lib/billing/play-config";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

async function handleGET(request: Request, diagnostics: RequestDiagnostics) {
  try {
    diagnostics.stage = "session_read";
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
    diagnostics.stage = "billing_prepare";
    const config = getPlayBillingConfig();
    if (!config) return NextResponse.json({ error: "play_unavailable" }, { status: 503, headers });
    return NextResponse.json({
      enabled: true,
      productId: config.productId,
      obfuscatedAccountId: playAccountId(user.id),
    }, { headers });
  } catch {
    return NextResponse.json({ error: "play_unavailable" }, { status: 503, headers });
  }
}

export async function GET(request: Request) {
  return diagnoseRequest(request, "billing", (diagnostics) => handleGET(request, diagnostics));
}
