import { getNativeBearer } from "@/lib/native-session";
import { getCurrentUser } from "@/lib/auth/session";
import { hasSameOrigin } from "@/lib/auth/same-origin";
import { checkNativeChallengeLimit } from "@/lib/generation/generation-limit";
import { hasExactKeys, NativeRequestError, readNativeJson } from "@/lib/native-contracts";
import { getTrialIdentity, isValidTrialToken } from "@/lib/generation/free-allowance";
import {
  createNativeChallenge,
  NativeAttestationUnavailableError,
  nativePrincipal,
  type NativeAttestationOperation,
} from "@/lib/native-attestation";
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
    body = await readNativeJson(request, 4_096);
  } catch (error) {
    if (error instanceof NativeRequestError && error.code === "body_too_large") {
      return errorResponse("request_too_large", 413);
    }
    return errorResponse("invalid_request", 400);
  }

  const operation = body.operation;
  const installId = body.installId;
  const sceneHash = body.sceneHash;
  if (
    (operation !== "guest" && operation !== "generate") ||
    typeof installId !== "string" ||
    !hasExactKeys(
      body,
      operation === "guest" ? ["operation", "installId"] : ["operation", "installId", "sceneHash"],
    ) ||
    (operation === "guest" && sceneHash !== undefined) ||
    (operation === "generate" && typeof sceneHash !== "string")
  ) {
    return errorResponse("invalid_request", 400);
  }

  let principal: string;
  if (operation === "generate") {
    const bearer = getNativeBearer(request);
    const trialToken = request.headers.get("x-doodle-trial-token");
    if (bearer && trialToken) return errorResponse("invalid_request", 400);
    if (bearer === null) return errorResponse("unauthorized", 401);
    if (bearer) {
      try {
        const user = await getCurrentUser(request);
        if (!user) return errorResponse("unauthorized", 401);
        principal = nativePrincipal("account", user.id);
      } catch {
        return errorResponse("native_generation_unavailable", 503);
      }
    } else {
      let validTrialToken = false;
      try {
        validTrialToken = Boolean(trialToken && isValidTrialToken(trialToken));
      } catch {
        return errorResponse("native_generation_unavailable", 503);
      }
      if (!validTrialToken) return errorResponse("unauthorized", 401);
      try {
        principal = nativePrincipal("trial", getTrialIdentity(request).id);
      } catch {
        return errorResponse("unauthorized", 401);
      }
    }
  } else {
    if (getNativeBearer(request) !== undefined || request.headers.has("x-doodle-trial-token")) {
      return errorResponse("invalid_request", 400);
    }
    try {
      principal = nativePrincipal("install", installId);
    } catch {
      return errorResponse("invalid_request", 400);
    }
  }

  const challengeLimit = await checkNativeChallengeLimit(request, operation as "guest" | "generate");
  if (challengeLimit === "rate_limited") return errorResponse("rate_limited", 429);
  if (challengeLimit === "unavailable") return errorResponse("native_generation_unavailable", 503);

  try {
    const challenge = await createNativeChallenge({
      operation: operation as NativeAttestationOperation,
      installId,
      sceneHash: operation === "generate" ? sceneHash as string : null,
      principal,
    });
    return NextResponse.json(challenge, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof NativeAttestationUnavailableError) {
      return errorResponse("native_generation_unavailable", 503);
    }
    if (error instanceof Error && error.message.startsWith("Invalid native")) {
      return errorResponse("invalid_request", 400);
    }
    return errorResponse("native_generation_unavailable", 503);
  }
}
