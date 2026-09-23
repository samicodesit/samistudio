import { hasSameOrigin } from "@/lib/auth/same-origin";
import { getFreeRemaining, signedTrialToken, TRIAL_TTL_SECONDS } from "@/lib/generation/free-allowance";
import { hasExactKeys, NativeRequestError, readNativeJson } from "@/lib/native-contracts";
import { getOrCreateNativeTrialIdentity } from "@/lib/native-guest";
import { consumeNativeAttestation, nativePrincipal } from "@/lib/native-attestation";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: string, status: number) {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) return errorResponse("forbidden", 403);

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
    !hasExactKeys(body, ["installId", "challenge", "integrityToken"]) ||
    typeof body.installId !== "string" ||
    typeof body.challenge !== "string" ||
    typeof body.integrityToken !== "string"
  ) {
    return errorResponse("invalid_request", 400);
  }

  let integrity: "verified" | "unavailable" | "invalid";
  try {
    integrity = await consumeNativeAttestation({
      operation: "guest",
      installId: body.installId,
      sceneHash: null,
      principal: nativePrincipal("install", body.installId),
      challenge: body.challenge,
      integrityToken: body.integrityToken,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Native attestation is unavailable") {
      return errorResponse("native_generation_unavailable", 503);
    }
    return errorResponse("native_generation_unavailable", 503);
  }
  if (integrity === "unavailable") return errorResponse("native_generation_unavailable", 503);
  if (integrity !== "verified") return errorResponse("native_attestation_failed", 403);

  try {
    const identity = await getOrCreateNativeTrialIdentity(body.installId);
    const freeRemaining = await getFreeRemaining(identity);
    return NextResponse.json(
      {
        trialToken: signedTrialToken(identity),
        expiresAt: Date.now() + TRIAL_TTL_SECONDS * 1000,
        freeRemaining,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return errorResponse("native_generation_unavailable", 503);
  }
}
