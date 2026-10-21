export const DETAIL_LEVELS = ["simple", "medium", "detailed"] as const;
export type DetailLevel = (typeof DETAIL_LEVELS)[number];
export const DEFAULT_DETAIL_LEVEL: DetailLevel = "medium";
export const DETAIL_STORAGE_KEY = "doodle.detail-level";

export function isDetailLevel(value: unknown): value is DetailLevel {
  return value === "simple" || value === "medium" || value === "detailed";
}
export function storedDetailLevel(value: unknown): DetailLevel {
  return isDetailLevel(value) ? value : DEFAULT_DETAIL_LEVEL;
}
export const PROMPT_VERSIONS = {
  simple: "simple-v3", medium: "medium-v1", detailed: "detailed-v1",
} as const satisfies Record<DetailLevel, string>;
