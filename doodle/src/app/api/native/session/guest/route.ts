import { diagnoseRequest, type RequestDiagnostics } from "@/lib/diagnostics/request";
import { hasSameOrigin } from "@/lib/auth/same-origin";
import { getFreeRemaining, signedTrialToken, TRIAL_TTL_SECONDS } from "@/lib/generation/free-allowance";
import { hasExactKeys, NativeRequestError, readNativeJson } from "@/lib/native-contracts";
import { getOrCreateNativeTrialIdentity } from "@/lib/native-guest";
import { consumeNativeAttestation, nativePrincipal } from "@/lib/native-attestation";
import { consumeAppleAssertion } from "@/lib/apple-attestation";
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
  const ios = request.headers.get("x-doodle-client") === "native-ios";

  let body: Record<string, unknown>;
  try {
    body = await readNativeJson(request, 16_384);
  } catch (error) {
    if (error instanceof NativeRequestError && error.code === "body_too_large") {
      return errorResponse("request_too_large", 413);
    }
    return errorResponse("invalid_request", 400);
  }
  if (
    !hasExactKeys(body, ios ? ["installId", "challenge", "keyId", "assertion"] : ["installId", "challenge", "integrityToken"]) ||
    typeof body.installId !== "string" ||
    typeof body.challenge !== "string" ||
    (ios ? typeof body.keyId !== "string" || typeof body.assertion !== "string" : typeof body.integrityToken !== "string")
  ) {
    return errorResponse("invalid_request", 400);
  }

  diagnostics.stage = "attestation_verify";
  let integrity: "verified" | "unavailable" | "invalid";
  try {
    const context = {
      operation: "guest",
      installId: body.installId,
      sceneHash: null,
      principal: nativePrincipal("install", body.installId),
      challenge: body.challenge,
    } as const;
    integrity = ios
      ? await consumeAppleAssertion({ ...context, keyId: body.keyId as string, assertion: body.assertion as string })
      : await consumeNativeAttestation({ ...context, integrityToken: body.integrityToken as string });
  } catch (error) {
    if (error instanceof Error && error.message === "Native attestation is unavailable") {
      return errorResponse("native_generation_unavailable", 503);
    }
    return errorResponse("native_generation_unavailable", 503);
  }
  if (integrity === "unavailable") return errorResponse("native_generation_unavailable", 503);
  if (integrity !== "verified") return errorResponse("native_attestation_failed", 403);

  try {
    diagnostics.stage = "account_read";
    const identity = await getOrCreateNativeTrialIdentity(body.installId);
    const freeRemaining = await getFreeRemaining(identity);
    return NextResponse.json(
      {
        trialToken: signedTrialToken(identity),
        expiresAt: Date.now() + TRIAL_TTL_SECONDS * 1000,
        // Build 6 and earlier reject a bootstrap balance above two. Account
        // refresh and generation still use the full server-enforced allowance.
        freeRemaining: request.headers.get("x-doodle-trial-policy") === "dynamic"
          ? freeRemaining : Math.min(2, freeRemaining),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return errorResponse("native_generation_unavailable", 503);
  }
}

export async function POST(request: NextRequest) {
  return diagnoseRequest(request, "guest", (diagnostics) => handlePOST(request, diagnostics));
}
