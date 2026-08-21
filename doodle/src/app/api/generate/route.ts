import { NextRequest, NextResponse } from "next/server";
import { generateDoodle, GenerationError } from "@/lib/generation/generate-doodle";
import { normalizeScene, SceneValidationError } from "@/lib/scenes/scene";
import { hasSameOrigin } from "@/lib/auth/same-origin";
import { checkGenerationLimit } from "@/lib/generation/generation-limit";
import { checkBotId } from "botid/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if ((await checkBotId()).isBot) {
    return NextResponse.json({ error: "bot_detected" }, { status: 403 });
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

  const limit = await checkGenerationLimit(request);
  if (limit === "rate_limited") {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  if (limit === "unavailable") {
    return NextResponse.json({ error: "limit_unavailable" }, { status: 503 });
  }

  try {
    const result = await generateDoodle(scene);
    return new Response(Buffer.from(result.bytes), {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
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
