import type { DetailLevel } from "./detail-level";

export type ImageQuality = "low" | "medium" | "high";

export const DOODLE_PAPER_COLOR = "#FFEB8A";

export interface GenerationProfile {
  id: DetailLevel;
  model: string;
  quality: ImageQuality;
  size: "1024x1024";
}

const configuredQuality = process.env.OPENAI_IMAGE_QUALITY || "medium";
if (!( ["low", "medium", "high"] as const).includes(configuredQuality as ImageQuality)) {
  throw new Error("OPENAI_IMAGE_QUALITY must be low, medium, or high");
}

export const SIMPLE_PROFILE: GenerationProfile = {
  id: "simple",
  model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-flare",
  quality: configuredQuality as ImageQuality,
  size: "1024x1024",
};

export function generationProfile(detailLevel: DetailLevel = "simple"): GenerationProfile {
  return detailLevel === "simple" ? SIMPLE_PROFILE : { ...SIMPLE_PROFILE, id: detailLevel };
}
