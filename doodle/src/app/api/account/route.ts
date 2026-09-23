import { hasSameOrigin } from "@/lib/auth/same-origin";
import { clearSessionCookie, getCurrentUser } from "@/lib/auth/session";
import { deletePaidAccount, getPaidBalance } from "@/lib/billing/credits";
import {
  getFreeRemaining,
  getTrialIdentity,
  setTrialCookie,
} from "@/lib/generation/free-allowance";
import { revokeNativeSession } from "@/lib/native-session";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export type AccountSummary = {
  authenticated: boolean;
  email: string | null;
  balance: number;
  freeRemaining: number | null;
};

function errorResponse(error: string, status: number) {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: NextRequest) {
  const identity = getTrialIdentity(request);
  const user = await getCurrentUser(request);
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
    return errorResponse("forbidden", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("confirmation_required", 400);
  }
  if (
    typeof body !== "object" ||
    body === null ||
    !("confirm" in body) ||
    body.confirm !== true
  ) {
    return errorResponse("confirmation_required", 400);
  }

  const user = await getCurrentUser(request);
  if (!user) {
    return errorResponse("unauthorized", 401);
  }

  try {
    await deletePaidAccount(user.id, user.identityKey);
    await revokeNativeSession(request);
    const response = new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
    clearSessionCookie(response);
    return response;
  } catch {
    return errorResponse("delete_failed", 500);
  }
}
