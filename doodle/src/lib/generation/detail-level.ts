export const DETAIL_LEVELS = ["simple", "medium", "detailed"] as const;
export type DetailLevel = (typeof DETAIL_LEVELS)[number];
export const DETAIL_STORAGE_KEY = "doodle.detail-level";

export function isDetailLevel(value: unknown): value is DetailLevel {
  return value === "simple" || value === "medium" || value === "detailed";
}
export function storedDetailLevel(value: unknown): DetailLevel {
  return isDetailLevel(value) ? value : "simple";
}
export const PROMPT_VERSIONS = {
  simple: "simple-v1", medium: "medium-v1", detailed: "detailed-v1",
} as const satisfies Record<DetailLevel, string>;
