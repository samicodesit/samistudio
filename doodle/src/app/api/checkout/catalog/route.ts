import { NextResponse } from "next/server";
import { checkWebCatalogLimit, getWebPackCatalog } from "@/lib/billing/web-packs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (process.env.STRIPE_PACKS_CHECKOUT_ENABLED !== "true") return NextResponse.json({error: "billing_unavailable"}, {status: 503, headers});
  const limit = await checkWebCatalogLimit(request);
  if (limit !== "allowed") return NextResponse.json({error: limit === "rate_limited" ? "rate_limited" : "billing_unavailable"}, {status: limit === "rate_limited" ? 429 : 503, headers});
  try { return NextResponse.json(await getWebPackCatalog(), {headers}); }
  catch { return NextResponse.json({error: "billing_unavailable"}, {status: 503, headers}); }
}
