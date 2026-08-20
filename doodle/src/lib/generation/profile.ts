export type ImageQuality = "low" | "medium" | "high";

export interface GenerationProfile {
  id: string;
  model: string;
  quality: ImageQuality;
  size: "1024x1024";
}

const configuredQuality = process.env.OPENAI_IMAGE_QUALITY || "low";
if (!( ["low", "medium", "high"] as const).includes(configuredQuality as ImageQuality)) {
  throw new Error("OPENAI_IMAGE_QUALITY must be low, medium, or high");
}

export const SIMPLE_PROFILE: GenerationProfile = {
  id: "simple",
  model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1-mini",
  quality: configuredQuality as ImageQuality,
  size: "1024x1024",
};
