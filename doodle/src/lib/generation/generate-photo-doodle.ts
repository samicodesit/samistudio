import { isPaperColorId, type PaperColorId } from "./paper-colors";
import OpenAI, { toFile } from "openai";
import { providerFailure } from "@/lib/diagnostics/provider";
import { GenerationError, type GeneratedDoodle } from "./generate-doodle";
import { isDetailLevel, type DetailLevel } from "./detail-level";
import { generationProfile } from "./profile";
import { buildPhotoPrompt } from "./photo-prompt";
import { correctPaperColor } from "./paper-color";

export interface PhotoImageClient {
  edit(input: OpenAI.Images.ImageEditParamsNonStreaming): Promise<{ data?: Array<{ b64_json?: string | null }> }>;
}

export async function generatePhotoDoodle(photo: Buffer, detailLevel: DetailLevel, imageClient?: PhotoImageClient, paperColor: PaperColorId = "yellow"): Promise<GeneratedDoodle> {
  if (!isPaperColorId(paperColor)) throw new Error("Invalid paper color");
  if (!isDetailLevel(detailLevel)) throw new Error("Invalid detail level");
  if (!imageClient && !process.env.OPENAI_API_KEY) throw new GenerationError("upstream", "OpenAI is not configured.");
  const profile = generationProfile(detailLevel);
  const client = imageClient ?? new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 150_000, maxRetries: 0 }).images;
  let encoded: string | undefined | null;
  try {
    const response = await client.edit({
      model: profile.model,
      image: await toFile(photo, "photo.jpg", { type: "image/jpeg" }),
      prompt: buildPhotoPrompt(detailLevel, paperColor),
      quality: "medium",
      size: profile.size,
      n: 1,
      output_format: "png",
    });
    encoded = response.data?.[0]?.b64_json;
  } catch (error) {
    const details = providerFailure(error);
    const value = error as { name?: string; code?: string; status?: number };
    if (error instanceof OpenAI.APIConnectionTimeoutError || value.name === "TimeoutError" || value.code === "ETIMEDOUT") throw new GenerationError("timeout", "Photo conversion timed out.", details);
    if (value.status === 400 && /safety|moderation|policy|content/i.test(value.code ?? "")) throw new GenerationError("refused", "Photo conversion was refused.", details);
    throw new GenerationError("upstream", "Photo conversion failed.", details);
  }
  if (!encoded) throw new GenerationError("malformed", "Photo conversion was incomplete.");
  try {
    const bytes = Buffer.from(encoded, "base64");
    if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error("invalid PNG");
    const corrected = await correctPaperColor(bytes, paperColor);
    return { bytes: corrected.bytes, mimeType: "image/png", paperCorrection: corrected.metadata };
  } catch { throw new GenerationError("malformed", "Photo conversion returned an invalid image."); }
}
