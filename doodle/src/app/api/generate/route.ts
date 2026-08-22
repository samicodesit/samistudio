import { randomUUID } from "node:crypto";
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
  releaseFreeDoodle,
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

async function finalizeWithReplay(operation: () => Promise<{ finalized: boolean; remaining: number }>) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await operation();
    } catch {}
  }
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
    | { kind: "paid"; userId: string }
    | { kind: "free"; identity: TrialIdentity }
    | undefined;

  if (user) {
    try {
      const paid = await reservePaidCredit(user.id, reservationId);
      if (paid.reserved) reservation = { kind: "paid", userId: user.id };
    } catch {
      try {
        await releasePaidCredit(user.id, reservationId);
      } catch {}
      return unavailable();
    }
  }

  if (!reservation) {
    let identity: TrialIdentity;
    try {
      identity = getTrialIdentity(request);
    } catch {
      return unavailable();
    }

    let free;
    try {
      free = await reserveFreeDoodle(identity, reservationId);
    } catch {
      try {
        await releaseFreeDoodle(identity, reservationId);
      } catch {}
      return unavailable();
    }

    if (!free.reserved) {
      try {
        const response = NextResponse.json(
          { error: "payment_required" },
          { status: 402, headers: { "X-Doodle-Free-Remaining": String(free.remaining) } },
        );
        setTrialCookie(response, identity);
        return response;
      } catch {
        return unavailable();
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
        const response = NextResponse.json(
          { error: limit === "rate_limited" ? "rate_limited" : "limit_unavailable" },
          { status: limit === "rate_limited" ? 429 : 503 },
        );
        setTrialCookie(response, reservation.identity);
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
    if (reservation.kind === "free") setTrialCookie(response, reservation.identity);
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
