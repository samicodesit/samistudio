import { mergeFunnelIdentity } from "@/lib/funnel-metrics";
import { getTrialIdentity, isValidTrialToken } from "@/lib/generation/free-allowance";
import { diagnoseRequest, type RequestDiagnostics } from "@/lib/diagnostics/request";
import { createOrGetGoogleAccount } from "@/lib/auth/accounts";
import { verifyGoogleCredential } from "@/lib/auth/google";
import { hasSameOrigin } from "@/lib/auth/same-origin";
import { hasExactKeys, NativeRequestError, readNativeJson } from "@/lib/native-contracts";
import { createNativeSession } from "@/lib/native-session";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: string, status: number) {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

async function handlePOST(request: NextRequest, diagnostics: RequestDiagnostics) {
  if (!hasSameOrigin(request)) return errorResponse("forbidden", 403);

  let body: Record<string, unknown>;
  try {
    body = await readNativeJson(request, 8_192);
  } catch (error) {
    if (error instanceof NativeRequestError && error.code === "body_too_large") {
      return errorResponse("request_too_large", 413);
    }
    return errorResponse("invalid_request", 400);
  }
  if (!hasExactKeys(body, ["credential"]) || typeof body.credential !== "string") {
    return errorResponse("invalid_request", 400);
  }

  diagnostics.stage = "google_token";
  let google: { sub: string; email: string };
  try {
    google = await verifyGoogleCredential(body.credential);
  } catch {
    return errorResponse("invalid_credential", 401);
  }

  try {
    diagnostics.stage = "account_read";
    const account = await createOrGetGoogleAccount(google.sub);
    const trialToken=request.headers.get("x-doodle-trial-token");
    if (trialToken && isValidTrialToken(trialToken)) {
      const trial=getTrialIdentity(request);
      await mergeFunnelIdentity("trial:"+trial.id,"account:"+account.id,google.email);
    }
    diagnostics.stage = "session_create";
    const session = await createNativeSession({ ...account, email: google.email });
    return NextResponse.json(
      { authenticated: true, email: google.email, ...session },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return errorResponse("auth_unavailable", 503);
  }
}

export async function POST(request: NextRequest) {
  return diagnoseRequest(request, "auth", (diagnostics) => handlePOST(request, diagnostics));
}
