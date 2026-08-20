import OpenAI from "openai";
import { normalizeScene } from "@/lib/scenes/scene";
import { SIMPLE_PROFILE } from "./profile";
import { buildDoodlePrompt } from "./prompt";

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
}

export type GenerationErrorKind = "refused" | "timeout" | "malformed" | "upstream";

export class GenerationError extends Error {
  constructor(readonly kind: GenerationErrorKind, message: string) {
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

export async function generateDoodle(scene: string, client: ImageClient = productionClient()): Promise<GeneratedDoodle> {
  const normalizedScene = normalizeScene(scene);

  let response: { data: Array<{ b64_json?: string | null }> };
  try {
    response = await client.generate({
      model: SIMPLE_PROFILE.model,
      prompt: buildDoodlePrompt(normalizedScene, SIMPLE_PROFILE),
      n: 1,
      size: SIMPLE_PROFILE.size,
      quality: SIMPLE_PROFILE.quality,
    });
  } catch (error) {
    if (isTimeout(error)) throw new GenerationError("timeout", "The image request timed out.");
    if (isRefusal(error)) throw new GenerationError("refused", "The image request was refused.");
    throw new GenerationError("upstream", "The image request failed.");
  }

  const encoded = response.data?.[0]?.b64_json;
  if (!encoded) {
    throw new GenerationError("malformed", "The image response was incomplete.");
  }

  try {
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.length === 0) throw new Error("empty image");
    return { bytes, mimeType: "image/png" };
  } catch {
    throw new GenerationError("malformed", "The image response was invalid.");
  }
}
