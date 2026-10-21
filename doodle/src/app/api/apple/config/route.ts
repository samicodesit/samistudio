import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getAppleBillingConfig } from "@/lib/billing/apple-config";
import { getPlayCatalog } from "@/lib/billing/play-catalog";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    if (!await getCurrentUser(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
    const config = getAppleBillingConfig();
    if (!config) return NextResponse.json({ error: "apple_unavailable" }, { status: 503, headers });
    return NextResponse.json({ enabled: true, environment: config.environment, ...getPlayCatalog() }, { headers });
  } catch { return NextResponse.json({ error: "apple_unavailable" }, { status: 503, headers }); }
}
