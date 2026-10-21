import { NextRequest, NextResponse } from "next/server";
import { AppleAttestationInvalidError, registerAppleKey } from "@/lib/apple-attestation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasSameOrigin } from "@/lib/auth/same-origin";
import { diagnoseRequest, type RequestDiagnostics } from "@/lib/diagnostics/request";
import { getTrialIdentity, isValidTrialToken } from "@/lib/generation/free-allowance";
import { checkNativeChallengeLimit } from "@/lib/generation/generation-limit";
import { hasExactKeys, NativeRequestError, readNativeJson } from "@/lib/native-contracts";
import { nativePrincipal } from "@/lib/native-attestation";
import { getNativeBearer } from "@/lib/native-session";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function error(code: string, status: number) { return NextResponse.json({ error: code }, { status, headers: { "Cache-Control": "no-store" } }); }
async function handle(request: NextRequest, diagnostics: RequestDiagnostics) {
  if (!hasSameOrigin(request) || request.headers.get("x-doodle-client") !== "native-ios") return error("forbidden", 403);
  let body: Record<string, unknown>;
  try { body = await readNativeJson(request, 49_152); } catch (e) { return error(e instanceof NativeRequestError && e.code === "body_too_large" ? "request_too_large" : "invalid_request", e instanceof NativeRequestError && e.code === "body_too_large" ? 413 : 400); }
  if (!hasExactKeys(body, ["installId", "keyId", "challenge", "attestation"]) || typeof body.installId !== "string" || typeof body.keyId !== "string" || typeof body.challenge !== "string" || typeof body.attestation !== "string" || body.attestation.length > 32_768) return error("invalid_request", 400);
  const bearer = getNativeBearer(request), trial = request.headers.get("x-doodle-trial-token");
  if (bearer && trial) return error("invalid_request", 400);
  if (bearer === null) return error("unauthorized", 401);
  let principal: string;
  diagnostics.stage = "session_read";
  if (bearer) {
    try { const user = await getCurrentUser(request); if (!user) return error("unauthorized", 401); principal = nativePrincipal("account", user.id); } catch { return error("native_generation_unavailable", 503); }
  } else if (trial) {
    try { if (!isValidTrialToken(trial)) return error("unauthorized", 401); principal = nativePrincipal("trial", getTrialIdentity(request).id); } catch { return error("native_generation_unavailable", 503); }
  } else {
    try { principal = nativePrincipal("install", body.installId); } catch { return error("invalid_request", 400); }
  }
  diagnostics.stage = "rate_limit";
  const limit = await checkNativeChallengeLimit(request, bearer || trial ? "generate" : "guest");
  if (limit !== "allowed") return error(limit === "rate_limited" ? "rate_limited" : "native_generation_unavailable", limit === "rate_limited" ? 429 : 503);
  try {
    diagnostics.stage = "attestation_verify";
    const result = await registerAppleKey({ principal, installId: body.installId, keyId: body.keyId, challenge: body.challenge, attestation: body.attestation });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return error(e instanceof AppleAttestationInvalidError ? "native_attestation_failed" : "native_generation_unavailable", e instanceof AppleAttestationInvalidError ? 403 : 503); }
}
export async function POST(request: NextRequest) { return diagnoseRequest(request, "integrity", diagnostics => handle(request, diagnostics)); }
