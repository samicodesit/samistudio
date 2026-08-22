import { hasSameOrigin } from "@/lib/auth/same-origin";
import { clearSessionCookie, getCurrentUser } from "@/lib/auth/session";
import { deletePaidAccount, getPaidBalance } from "@/lib/billing/credits";
import {
  getFreeRemaining,
  getTrialIdentity,
  setTrialCookie,
} from "@/lib/generation/free-allowance";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export type AccountSummary = {
  authenticated: boolean;
  email: string | null;
  balance: number;
  freeRemaining: number | null;
};

export async function GET(request: NextRequest) {
  const identity = getTrialIdentity(request);
  const user = await getCurrentUser();
  const summary: AccountSummary = user
    ? {
        authenticated: true,
        email: user.email,
        balance: await getPaidBalance(user.id),
        freeRemaining: null,
      }
    : {
        authenticated: false,
        email: null,
        balance: 0,
        freeRemaining: await getFreeRemaining(identity),
      };
  const response = NextResponse.json(summary, {
    headers: { "Cache-Control": "no-store" },
  });
  setTrialCookie(response, identity);
  return response;
}

export async function DELETE(request: NextRequest) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "confirmation_required" }, { status: 400 });
  }
  if (
    typeof body !== "object" ||
    body === null ||
    !("confirm" in body) ||
    body.confirm !== true
  ) {
    return NextResponse.json({ error: "confirmation_required" }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await deletePaidAccount(user.id, user.identityKey);
    const response = new NextResponse(null, { status: 204 });
    clearSessionCookie(response);
    return response;
  } catch {
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
}
