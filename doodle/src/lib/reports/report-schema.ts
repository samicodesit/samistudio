import { hasLocale, type Locale } from "@/lib/i18n";
import { normalizeScene, SceneValidationError } from "@/lib/scenes/scene";
import { REPORT_REASONS, type ReportReason } from "./report-types";

export const MAX_REPORT_BODY_BYTES = 120_000;
const MAX_DETAILS_LENGTH = 500;
const MAX_IMAGE_BYTES = 60_000;
const MAX_IMAGE_DIMENSION = 640;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export class ReportValidationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "ReportValidationError";
  }
}

export type ReportSubmission = {
  reason: ReportReason;
  details: string;
  locale: Locale;
  includeContent: false;
} | {
  reason: ReportReason;
  details: string;
  locale: Locale;
  includeContent: true;
  scene: string;
  image: {
    mimeType: "image/jpeg";
    base64: string;
    width: number;
    height: number;
  };
};

function jpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 1 >= bytes.length) return null;
    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
    const isStartOfFrame = (
      marker >= 0xc0 && marker <= 0xcf &&
      ![0xc4, 0xc8, 0xcc].includes(marker)
    );
    if (isStartOfFrame) {
      if (segmentLength < 7) return null;
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      return width > 0 && height > 0 ? { width, height } : null;
    }
    offset += segmentLength;
  }
  return null;
}

function parseImage(value: unknown) {
  if (typeof value !== "string" || value.length === 0 || value.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 || !BASE64_PATTERN.test(value)) {
    throw new ReportValidationError("invalid_image");
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES || bytes.toString("base64") !== value) {
    throw new ReportValidationError("invalid_image");
  }
  const dimensions = jpegDimensions(bytes);
  if (!dimensions || dimensions.width > MAX_IMAGE_DIMENSION || dimensions.height > MAX_IMAGE_DIMENSION) {
    throw new ReportValidationError("invalid_image");
  }
  return { mimeType: "image/jpeg" as const, base64: value, ...dimensions };
}

export function parseReportSubmission(value: unknown): ReportSubmission {
  if (!value || typeof value !== "object") throw new ReportValidationError("invalid_report");
  const body = value as Record<string, unknown>;
  if (typeof body.reason !== "string" || !(REPORT_REASONS as readonly string[]).includes(body.reason)) {
    throw new ReportValidationError("invalid_reason");
  }
  const reason = body.reason as ReportReason;
  if (typeof body.details !== "string" || body.details.length > MAX_DETAILS_LENGTH) {
    throw new ReportValidationError("invalid_details");
  }
  const details = body.details.trim();
  if (reason === "other" && !details) throw new ReportValidationError("details_required");
  if (typeof body.locale !== "string" || !hasLocale(body.locale)) {
    throw new ReportValidationError("invalid_locale");
  }
  if (typeof body.includeContent !== "boolean") throw new ReportValidationError("invalid_consent");

  if (!body.includeContent) {
    if (body.scene !== undefined || body.imageBase64 !== undefined) {
      throw new ReportValidationError("content_without_consent");
    }
    return { reason, details, locale: body.locale, includeContent: false };
  }

  let scene: string;
  try {
    scene = normalizeScene(body.scene);
  } catch (error) {
    if (error instanceof SceneValidationError) throw new ReportValidationError("invalid_scene");
    throw error;
  }
  return {
    reason,
    details,
    locale: body.locale,
    includeContent: true,
    scene,
    image: parseImage(body.imageBase64),
  };
}
