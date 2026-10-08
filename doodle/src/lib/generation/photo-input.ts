// Shared wire contract. Keep this module free of Node/browser dependencies.
export const MAX_PHOTO_BYTES = 512_000;
export const MAX_PHOTO_SOURCE_BYTES = 20_000_000;
export const MAX_PHOTO_SOURCE_PIXELS = 64_000_000;
export const MAX_PHOTO_BASE64_LENGTH = Math.ceil(MAX_PHOTO_BYTES / 3) * 4;
export const MAX_PHOTO_REQUEST_BYTES = MAX_PHOTO_BASE64_LENGTH + 256;
export const PHOTO_MAX_EDGE = 600;
export function photoByteLength(base64: string): number {
  return base64.length / 4 * 3 - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
}
export const PHOTO_PROMPT_VERSIONS = { simple: "photo-v3-simple", medium: "photo-v3-medium", detailed: "photo-v3-detailed" } as const;

export function isPhotoPayload(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_PHOTO_BASE64_LENGTH
    && value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

// Domain separation prevents a text request from reusing a photo attestation.
export function photoAttestationInput(base64: string): string {
  return `doodle-photo-v1:${base64}`;
}
