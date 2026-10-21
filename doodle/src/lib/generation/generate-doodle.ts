import { isPaperColorId, type PaperColorId } from "./paper-colors";
import OpenAI from "openai";
import { providerFailure, type ProviderFailure } from "@/lib/diagnostics/provider";
import { normalizeScene } from "@/lib/scenes/scene";
import { generationProfile } from "./profile";
import { isDetailLevel, PROMPT_VERSIONS, type DetailLevel } from "./detail-level";
import { buildDoodlePrompt } from "./prompt";
import { correctPaperColor } from "./paper-color";
import type { PaperCorrectionMetadata } from "./paper-color-metadata";

export interface ImageClient {
  generate(input: {
    model: string;
    prompt: string;
    n: 1;
    size: "1024x1024";
    quality: "low" | "medium" | "high";
  }): Promise<{ data: Array<{ b64_json?: string | null }> }>;
}

export interface GeneratedDoodle {
  bytes: Uint8Array;
  mimeType: "image/png";
  paperCorrection?: PaperCorrectionMetadata;
}

export type GenerationErrorKind = "refused" | "timeout" | "malformed" | "upstream";

export class GenerationError extends Error {
  constructor(readonly kind: GenerationErrorKind, message: string, readonly diagnostics: ProviderFailure = {}) {
    super(message);
    this.name = "GenerationError";
  }
}

function isTimeout(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: string; code?: string; message?: string };
  const message = candidate.message?.toLowerCase() || "";
  return (
    candidate.name === "TimeoutError" ||
    candidate.code === "ETIMEDOUT" ||
    candidate.code === "ECONNABORTED" ||
    message.includes("timed out") ||
    message.includes("timeout")
  );
}

function isRefusal(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { status?: number; code?: string; message?: string };
  const message = candidate.message?.toLowerCase() || "";
  const code = candidate.code?.toLowerCase() || "";
  return (
    candidate.status === 400 &&
    (code.includes("safety") || code.includes("moderation") || code.includes("policy") || message.includes("safety") || message.includes("policy") || message.includes("content"))
  );
}

function productionClient(): ImageClient {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new GenerationError("upstream", "OpenAI is not configured.");
  }

  const client = new OpenAI({ apiKey, timeout: 150_000, maxRetries: 0 });
  return {
    generate: async (input) => {
      const response = await client.images.generate(input);
      return { data: response.data ?? [] };
    },
  };
}

export async function generateDoodle(scene: string, client: ImageClient | undefined = undefined, detailLevel: DetailLevel = "simple", paperColor: PaperColorId = "yellow"): Promise<GeneratedDoodle> {
  if (!isPaperColorId(paperColor)) throw new Error("Invalid paper color");
  if (!isDetailLevel(detailLevel)) throw new Error("Invalid detail level");
  const normalizedScene = normalizeScene(scene);
  const profile = generationProfile(detailLevel);
  const imageClient = client ?? productionClient();

  if (process.env.NODE_ENV === "production") {
    console.info("[doodle-generation-profile]", {
      detailLevel,
      promptVersion: PROMPT_VERSIONS[detailLevel],
      model: profile.model,
      quality: profile.quality,
      size: profile.size,
    });
  }

  let response: { data: Array<{ b64_json?: string | null }> };
  try {
    response = await imageClient.generate({
      model: profile.model,
      prompt: buildDoodlePrompt(normalizedScene, profile, paperColor),
      n: 1,
      size: profile.size,
      quality: profile.quality,
    });
  } catch (error) {
    const diagnostics = providerFailure(error);
    if (isTimeout(error)) throw new GenerationError("timeout", "The image request timed out.", diagnostics);
    if (isRefusal(error)) throw new GenerationError("refused", "The image request was refused.", diagnostics);
    throw new GenerationError("upstream", "The image request failed.", diagnostics);
  }

  const encoded = response.data?.[0]?.b64_json;
  if (!encoded) {
    throw new GenerationError("malformed", "The image response was incomplete.");
  }

  try {
    const bytes = Buffer.from(encoded, "base64");
    const pngSignature = [0x89, 0x50, 0x4e, 0x47];
    if (bytes.length < pngSignature.length || !pngSignature.every((byte, index) => bytes[index] === byte)) {
      throw new Error("invalid PNG");
    }
    const corrected = await correctPaperColor(bytes, paperColor);
    return { bytes: corrected.bytes, mimeType: "image/png", paperCorrection: corrected.metadata };
  } catch {
    throw new GenerationError("malformed", "The image response was invalid.");
  }
}
