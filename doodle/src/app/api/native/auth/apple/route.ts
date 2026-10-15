import { createOrGetAppleAccount } from "@/lib/auth/accounts";
import { verifyAppleIdentityToken } from "@/lib/auth/apple";
import { exchangeAppleAuthorizationCode, getAppleSignInConfig, storeAppleAuthorization } from "@/lib/auth/apple-tokens";
import { hasSameOrigin } from "@/lib/auth/same-origin";
import { diagnoseRequest, type RequestDiagnostics } from "@/lib/diagnostics/request";
import { mergeFunnelIdentity } from "@/lib/funnel-metrics";
import { getTrialIdentity, isValidTrialToken } from "@/lib/generation/free-allowance";
import { hasExactKeys, NativeRequestError, readNativeJson } from "@/lib/native-contracts";
import { createNativeSession } from "@/lib/native-session";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function error(code: string, status: number) {
  return NextResponse.json({ error: code }, { status, headers: { "Cache-Control": "no-store" } });
}

async function handlePOST(request: NextRequest, diagnostics: RequestDiagnostics) {
  if (!hasSameOrigin(request)) return error("forbidden", 403);
  if (request.headers.get("x-doodle-client") !== "native-ios") return error("invalid_request", 400);
  let body: Record<string, unknown>;
  try { body = await readNativeJson(request, 16_384); }
  catch (failure) { return error(failure instanceof NativeRequestError && failure.code === "body_too_large" ? "request_too_large" : "invalid_request", failure instanceof NativeRequestError && failure.code === "body_too_large" ? 413 : 400); }
  if (!hasExactKeys(body, ["identityToken", "authorizationCode", "nonce"]) ||
      typeof body.identityToken !== "string" || !body.identityToken || body.identityToken.length > 12_000 ||
      typeof body.authorizationCode !== "string" || !body.authorizationCode || body.authorizationCode.length > 4_096 ||
      typeof body.nonce !== "string" || !/^[a-f0-9]{64}$/.test(body.nonce)) return error("invalid_request", 400);
  try { getAppleSignInConfig(); } catch { return error("auth_unavailable", 503); }

  diagnostics.stage = "apple_token";
  let identity: { sub: string; email: string | null; authenticatedAt: number };
  try { identity = await verifyAppleIdentityToken(body.identityToken, body.nonce); }
  catch { return error("invalid_credential", 401); }
  let refreshToken: string;
  try { refreshToken = await exchangeAppleAuthorizationCode(body.authorizationCode, identity.sub); }
  catch (failure) {
    return error(failure && typeof failure === "object" && "kind" in failure && failure.kind === "invalid" ? "invalid_credential" : "auth_unavailable", failure && typeof failure === "object" && "kind" in failure && failure.kind === "invalid" ? 401 : 503);
  }
  try {
    diagnostics.stage = "account_read";
    const account = await createOrGetAppleAccount(identity.sub);
    await storeAppleAuthorization(account, refreshToken, identity.authenticatedAt);
    const trialToken = request.headers.get("x-doodle-trial-token");
    if (trialToken && isValidTrialToken(trialToken)) {
      const trial = getTrialIdentity(request);
      await mergeFunnelIdentity(`trial:${trial.id}`, `account:${account.id}`, identity.email ?? undefined);
    }
    diagnostics.stage = "session_create";
    const session = await createNativeSession({ ...account, provider: "apple", email: identity.email, appleAuthenticatedAt: identity.authenticatedAt });
    return NextResponse.json({ authenticated: true, provider: "apple", email: identity.email, ...session }, { headers: { "Cache-Control": "no-store" } });
  } catch { return error("auth_unavailable", 503); }
}

export async function POST(request: NextRequest) {
  return diagnoseRequest(request, "auth", diagnostics => handlePOST(request, diagnostics));
}
