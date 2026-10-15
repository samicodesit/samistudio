import { mergeFunnelIdentity } from "@/lib/funnel-metrics";
import { diagnoseRequest, type RequestDiagnostics } from "@/lib/diagnostics/request";
import { hasSameOrigin } from "@/lib/auth/same-origin";
import { clearSessionCookie, getCurrentUser } from "@/lib/auth/session";
import { revokeAppleAuthorization } from "@/lib/auth/apple-tokens";
import { deletePaidAccount, getPaidBalance, getPurchaseHistory } from "@/lib/billing/credits";
import { getAppleCreditScope } from "@/lib/billing/apple-credit-scope";
import {
  isValidTrialToken,
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
  hasPurchased?: boolean | null;
};

function errorResponse(error: string, status: number) {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

async function handleGET(request: NextRequest, diagnostics: RequestDiagnostics) {
  const client = request.headers.get("x-doodle-client");
  const isNativeClient = client === "native-android" || client === "native-ios";
  diagnostics.stage = "session_read";
  const identity = getTrialIdentity(request);
  diagnostics.stage = "session_read";
  const user = await getCurrentUser(request);
  const creditArgs: [] | ["apple-sandbox"] = user && await getAppleCreditScope(request, user.id) === "apple-sandbox" ? ["apple-sandbox"] : [];
  diagnostics.stage = "account_read";
  const trialToken=request.cookies.get("doodle_trial")?.value;
  // The cookie returns on this same-site GET after Google's cross-site POST.
  if(user && request.headers.get("x-doodle-packs")==="v1" && trialToken && isValidTrialToken(trialToken))await mergeFunnelIdentity("trial:"+identity.id,"account:"+user.id,user.email ?? undefined);
  const summary: AccountSummary = user
    ? {
        authenticated: true,
        email: user.email,
        balance: await getPaidBalance(user.id, ...creditArgs),
        freeRemaining: isNativeClient && request.headers.has("authorization")
          ? null
          : await getFreeRemaining(identity),
      }
    : {
        authenticated: false,
        email: null,
        balance: 0,
        freeRemaining: await getFreeRemaining(identity),
      };
  if (isNativeClient || request.headers.get("x-doodle-packs") === "v1") {
    summary.hasPurchased = user ? await getPurchaseHistory(user.id, ...creditArgs) : false;
  }
  const response = NextResponse.json(summary, {
    headers: { "Cache-Control": "no-store" },
  });
  setTrialCookie(response, identity);
  return response;
}

async function handleDELETE(request: NextRequest, diagnostics: RequestDiagnostics) {
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

  diagnostics.stage = "session_read";
  const user = await getCurrentUser(request);
  if (!user) {
    return errorResponse("unauthorized", 401);
  }

  try {
    diagnostics.stage = "account_read";
    if (user.provider === "apple") {
      const revokedAuthorization = await revokeAppleAuthorization(user.id);
      if (!revokedAuthorization) throw new Error("Apple revocation unavailable");
      await deletePaidAccount(user.id, user.identityKey, "apple", revokedAuthorization);
    } else {
      await deletePaidAccount(user.id, user.identityKey);
    }
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

export async function GET(request: NextRequest) {
  return diagnoseRequest(request, "account", (diagnostics) => handleGET(request, diagnostics));
}

export async function DELETE(request: NextRequest) {
  return diagnoseRequest(request, "account", (diagnostics) => handleDELETE(request, diagnostics));
}
