import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getPlayBillingConfig, playAccountId } from "@/lib/billing/play-config";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function GET(request?: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
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
