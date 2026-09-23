import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { generateDoodle, GenerationError } from "@/lib/generation/generate-doodle";
import { normalizeScene, SceneValidationError } from "@/lib/scenes/scene";
import { hasSameOrigin } from "@/lib/auth/same-origin";
import { checkGenerationLimit } from "@/lib/generation/generation-limit";
import { getCurrentUser } from "@/lib/auth/session";
import { finalizePaidCredit, releasePaidCredit, reservePaidCredit } from "@/lib/billing/credits";
import {
  finalizeFreeDoodle,
  getTrialIdentity,
  isValidTrialToken,
  releaseFreeDoodle,
  reserveFreeDoodle,
  setTrialCookie,
  type TrialIdentity,
} from "@/lib/generation/free-allowance";
import { getNativeBearer } from "@/lib/native-session";
import { consumeNativeAttestation, nativePrincipal } from "@/lib/native-attestation";
import { hasExactKeys, NativeRequestError, readNativeJson } from "@/lib/native-contracts";
import { checkBotId } from "botid/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

function unavailable(nativeClient = false) {
  return NextResponse.json(
    { error: "limit_unavailable" },
    nativeClient
      ? { status: 503, headers: { "Cache-Control": "no-store" } }
      : { status: 503 },
  );
}

function nativeError(error: string, status: number) {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

async function finalizeWithReplay(operation: () => Promise<{ finalized: boolean; remaining: number }>) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await operation();
    } catch {}
  }
}

export async function POST(request: NextRequest) {
  const nativeClient = request.headers.get("x-doodle-client") === "native-android";
  if (!hasSameOrigin(request)) {
    return nativeClient ? nativeError("forbidden", 403) : NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!nativeClient) {
    try {
      if ((await checkBotId()).isBot) {
        return NextResponse.json({ error: "bot_detected" }, { status: 403 });
      }
    } catch {
      return unavailable(nativeClient);
    }
  }

  let body: unknown;
  try {
    body = nativeClient ? await readNativeJson(request, 16_384) : await request.json();
  } catch (error) {
    if (nativeClient) {
      return error instanceof NativeRequestError && error.code === "body_too_large"
        ? nativeError("request_too_large", 413)
        : nativeError("invalid_request", 400);
    }
    return NextResponse.json({ error: "invalid_scene" }, { status: 400 });
  }
  if (nativeClient && (typeof body !== "object" || body === null || Array.isArray(body) || !hasExactKeys(body as Record<string, unknown>, ["scene"]))) {
    return nativeError("invalid_request", 400);
  }

  const sceneValue =
    typeof body === "object" && body !== null && "scene" in body
      ? (body as { scene?: unknown }).scene
      : undefined;

  let scene: string;
  try {
    scene = normalizeScene(sceneValue);
  } catch (error) {
    if (error instanceof SceneValidationError) {
      return nativeClient ? nativeError(error.code, 400) : NextResponse.json({ error: error.code }, { status: 400 });
    }
    return nativeClient ? nativeError("invalid_scene", 400) : NextResponse.json({ error: "invalid_scene" }, { status: 400 });
  }

  let user: Awaited<ReturnType<typeof getCurrentUser>> = null;
  let nativeBearer: string | null | undefined;
  let nativeTrialIdentity: TrialIdentity | undefined;
  let nativePrincipalValue: string | undefined;
  if (nativeClient) {
    nativeBearer = getNativeBearer(request);
    const trialToken = request.headers.get("x-doodle-trial-token");
    if (nativeBearer === null) return nativeError("unauthorized", 401);
    if (nativeBearer && trialToken) return nativeError("invalid_request", 400);

    if (nativeBearer) {
      try {
        user = await getCurrentUser(request);
        if (!user) return nativeError("unauthorized", 401);
        nativePrincipalValue = nativePrincipal("account", user.id);
      } catch {
        return nativeError("native_generation_unavailable", 503);
      }
    } else {
      let validTrialToken = false;
      try {
        validTrialToken = Boolean(trialToken && isValidTrialToken(trialToken));
      } catch {
        return nativeError("native_generation_unavailable", 503);
      }
      if (!validTrialToken) return nativeError("unauthorized", 401);
      try {
        nativeTrialIdentity = getTrialIdentity(request);
        nativePrincipalValue = nativePrincipal("trial", nativeTrialIdentity.id);
      } catch {
        return nativeError("unauthorized", 401);
      }
    }

    const installId = request.headers.get("x-doodle-install-id");
    const challenge = request.headers.get("x-doodle-attestation-challenge");
    const integrityToken = request.headers.get("x-doodle-attestation-token");
    if (!installId || !challenge || !integrityToken || !nativePrincipalValue) {
      return nativeError("native_attestation_required", 403);
    }
    let integrity: "verified" | "unavailable" | "invalid";
    try {
      integrity = await consumeNativeAttestation({
        operation: "generate",
        installId,
        sceneHash: createHash("sha256").update(scene).digest("hex"),
        principal: nativePrincipalValue,
        challenge,
        integrityToken,
      });
    } catch {
      return nativeError("native_generation_unavailable", 503);
    }
    if (integrity === "unavailable") return nativeError("native_generation_unavailable", 503);
    if (integrity !== "verified") return nativeError("native_attestation_failed", 403);
  }

  const reservationId = randomUUID();
  if (!nativeClient) {
    try {
      user = await getCurrentUser();
    } catch {
      return unavailable(nativeClient);
    }
  }

  let reservation:
    | { kind: "paid"; userId: string }
    | { kind: "free"; identity: TrialIdentity }
    | undefined;

  if (user) {
    let paid: Awaited<ReturnType<typeof reservePaidCredit>> | undefined;
    try {
      paid = await reservePaidCredit(user.id, reservationId);
      if (paid.reserved) reservation = { kind: "paid", userId: user.id };
    } catch {
      try {
        await releasePaidCredit(user.id, reservationId);
      } catch {}
      return unavailable(nativeClient);
    }
    if (!reservation && nativeClient && nativeBearer) {
      return NextResponse.json(
        { error: "payment_required" },
        {
          status: 402,
          headers: {
            "Cache-Control": "no-store",
            "X-Doodle-Paid-Remaining": String(paid?.remaining ?? 0),
          },
        },
      );
    }
  }

  if (!reservation) {
    let identity: TrialIdentity;
    try {
      identity = nativeTrialIdentity ?? getTrialIdentity(request);
    } catch {
      return unavailable(nativeClient);
    }

    let free;
    try {
      free = await reserveFreeDoodle(identity, reservationId);
    } catch {
      try {
        await releaseFreeDoodle(identity, reservationId);
      } catch {}
      return unavailable(nativeClient);
    }

    if (!free.reserved) {
      try {
        const response = NextResponse.json(
          { error: "payment_required" },
          {
            status: 402,
            headers: {
              "X-Doodle-Free-Remaining": String(free.remaining),
              ...(nativeClient ? { "Cache-Control": "no-store" } : {}),
            },
          },
        );
        if (!nativeClient) setTrialCookie(response, identity);
        return response;
      } catch {
        return unavailable(nativeClient);
      }
    }
    reservation = { kind: "free", identity };
  }

  let released = false;
  const release = async () => {
    if (released) return;
    released = true;
    try {
      if (reservation.kind === "paid") await releasePaidCredit(reservation.userId, reservationId);
      else await releaseFreeDoodle(reservation.identity, reservationId);
    } catch {
      // Holds expire after ten minutes, so release is only a latency optimization.
    }
  };

  let infrastructureFailure = false;
  try {
    if (reservation.kind === "free") {
      infrastructureFailure = true;
      const limit = await checkGenerationLimit(request);
      if (limit !== "allowed") {
        const response = nativeClient
          ? nativeError(limit === "rate_limited" ? "rate_limited" : "limit_unavailable", limit === "rate_limited" ? 429 : 503)
          : NextResponse.json(
              { error: limit === "rate_limited" ? "rate_limited" : "limit_unavailable" },
              { status: limit === "rate_limited" ? 429 : 503 },
            );
        if (!nativeClient) setTrialCookie(response, reservation.identity);
        await release();
        return response;
      }
    }

    infrastructureFailure = false;
    const result = await generateDoodle(scene);
    infrastructureFailure = true;
    const response = new NextResponse(Buffer.from(result.bytes), {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Cache-Control": "no-store",
      },
    });
    if (reservation.kind === "free" && !nativeClient) setTrialCookie(response, reservation.identity);
    const finalized = await finalizeWithReplay(
      reservation.kind === "paid"
        ? () => finalizePaidCredit(reservation.userId, reservationId)
        : () => finalizeFreeDoodle(reservation.identity, reservationId),
    );
    if (!finalized) {
      response.headers.set("X-Doodle-Balance-Uncertain", "1");
      return response;
    }
    if (!finalized.finalized) {
      throw new Error(`${reservation.kind} reservation finalization failed`);
    }
    response.headers.set(
      reservation.kind === "paid" ? "X-Doodle-Paid-Remaining" : "X-Doodle-Free-Remaining",
      String(finalized.remaining),
    );

    return response;
  } catch (error) {
    await release();
    if (infrastructureFailure) return unavailable(nativeClient);
    if (error instanceof GenerationError) {
      if (error.kind === "refused") {
        return nativeClient ? nativeError("refused", 422) : NextResponse.json({ error: "refused" }, { status: 422 });
      }
      if (error.kind === "timeout") {
        return nativeClient ? nativeError("timeout", 504) : NextResponse.json({ error: "timeout" }, { status: 504 });
      }
    }
    return nativeClient ? nativeError("temporary_error", 502) : NextResponse.json({ error: "temporary_error" }, { status: 502 });
  }
}
