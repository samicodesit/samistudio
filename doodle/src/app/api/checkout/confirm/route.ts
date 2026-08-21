import { hasSameOrigin } from "@/lib/auth/same-origin";
import { fulfillCheckout } from "@/lib/billing/checkout";
import { getCurrentUser } from "@/lib/supabase/session";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  }
  const sessionId =
    typeof body === "object" && body !== null && "sessionId" in body
      ? body.sessionId
      : undefined;
  if (typeof sessionId !== "string" || sessionId.trim() === "") {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json({
      balance: await fulfillCheckout(sessionId, user.id),
    });
  } catch {
    return NextResponse.json({ error: "billing_unavailable" }, { status: 503 });
  }
}
