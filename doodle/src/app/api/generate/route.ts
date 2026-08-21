import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { generateDoodle, GenerationError } from "@/lib/generation/generate-doodle";
import { normalizeScene, SceneValidationError } from "@/lib/scenes/scene";
import { hasSameOrigin } from "@/lib/auth/same-origin";
import { checkGenerationLimit } from "@/lib/generation/generation-limit";
import { getCurrentUser } from "@/lib/supabase/session";
import { refundPaidCredit, reservePaidCredit } from "@/lib/billing/credits";
import {
  finalizeFreeDoodle,
  getTrialIdentity,
  refundFreeDoodle,
  reserveFreeDoodle,
  setTrialCookie,
  type TrialIdentity,
} from "@/lib/generation/free-allowance";
import { checkBotId } from "botid/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

function unavailable() {
  return NextResponse.json({ error: "limit_unavailable" }, { status: 503 });
}

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    if ((await checkBotId()).isBot) {
      return NextResponse.json({ error: "bot_detected" }, { status: 403 });
    }
  } catch {
    return unavailable();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_scene" }, { status: 400 });
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
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    return NextResponse.json({ error: "invalid_scene" }, { status: 400 });
  }

  const reservationId = randomUUID();
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return unavailable();
  }

  let reservation:
    | { kind: "paid"; userId: string; remaining: number }
    | { kind: "free"; identity: TrialIdentity; remaining: number }
    | undefined;

  if (user) {
    try {
      const paid = await reservePaidCredit(user.id, reservationId);
      if (paid.reserved) reservation = { kind: "paid", userId: user.id, remaining: paid.remaining };
    } catch {
      return unavailable();
    }
  }

  if (!reservation) {
    try {
      const identity = getTrialIdentity(request);
      const free = await reserveFreeDoodle(identity, reservationId);
      if (!free.reserved) {
        const response = NextResponse.json(
          { error: "payment_required" },
          { status: 402, headers: { "X-Doodle-Free-Remaining": String(free.remaining) } },
        );
        setTrialCookie(response, identity);
        return response;
      }
      reservation = { kind: "free", identity, remaining: free.remaining };
    } catch {
      return unavailable();
    }
  }

  let refunded = false;
  const refund = async () => {
    if (refunded) return;
    refunded = true;
    try {
      if (reservation.kind === "paid") await refundPaidCredit(reservation.userId, reservationId);
      else await refundFreeDoodle(reservation.identity, reservationId);
    } catch {
      // The reservation APIs are idempotent; one best-effort attempt is the safe boundary here.
    }
  };

  let infrastructureFailure = false;
  try {
    if (reservation.kind === "free") {
      infrastructureFailure = true;
      const limit = await checkGenerationLimit(request);
      if (limit !== "allowed") {
        const response = NextResponse.json(
          { error: limit === "rate_limited" ? "rate_limited" : "limit_unavailable" },
          { status: limit === "rate_limited" ? 429 : 503 },
        );
        setTrialCookie(response, reservation.identity);
        await refund();
        return response;
      }
    }

    infrastructureFailure = false;
    const result = await generateDoodle(scene);
    const response = new NextResponse(Buffer.from(result.bytes), {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Cache-Control": "no-store",
      },
    });
    response.headers.set(
      reservation.kind === "paid" ? "X-Doodle-Paid-Remaining" : "X-Doodle-Free-Remaining",
      String(reservation.remaining),
    );

    if (reservation.kind === "free") {
      infrastructureFailure = true;
      setTrialCookie(response, reservation.identity);
      if ((await finalizeFreeDoodle(reservation.identity, reservationId)) !== 1) {
        throw new Error("Free reservation finalization failed");
      }
    }

    return response;
  } catch (error) {
    await refund();
    if (infrastructureFailure) return unavailable();
    if (error instanceof GenerationError) {
      if (error.kind === "refused") {
        return NextResponse.json({ error: "refused" }, { status: 422 });
      }
      if (error.kind === "timeout") {
        return NextResponse.json({ error: "timeout" }, { status: 504 });
      }
    }
    return NextResponse.json({ error: "temporary_error" }, { status: 502 });
  }
}
