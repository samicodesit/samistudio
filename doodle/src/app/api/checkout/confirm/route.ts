import { readNativeJson } from "@/lib/native-contracts";
import { hasSameOrigin } from "@/lib/auth/same-origin";
import { fulfillCheckout, fulfillCheckoutDetails } from "@/lib/billing/checkout";
import { getCurrentUser } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await readNativeJson(request, 1024);
  } catch {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  }
  const sessionId =
    typeof body === "object" && body !== null && "sessionId" in body
      ? body.sessionId
      : undefined;
  if (typeof sessionId !== "string" || !/^cs_[A-Za-z0-9_]{1,240}$/.test(sessionId)) {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    if (request.headers.get("x-doodle-packs") === "v1") return NextResponse.json(await fulfillCheckoutDetails(sessionId,user.id),{headers:{"Cache-Control":"no-store"}});
    return NextResponse.json({ balance: await fulfillCheckout(sessionId, user.id) });
  } catch (error) {
    if (request.headers.get("x-doodle-packs") === "v1" && error instanceof Error && error.message === "checkout_pending") return NextResponse.json({pending:true},{status:202,headers:{"Cache-Control":"no-store"}});
    if (request.headers.get("x-doodle-packs") === "v1" && error instanceof Error && error.message === "checkout_failed") return NextResponse.json({error:"checkout_failed"},{status:409,headers:{"Cache-Control":"no-store"}});
    return NextResponse.json({ error: "billing_unavailable" }, { status: 503 });
  }
}
