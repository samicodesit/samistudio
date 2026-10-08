import sharp from "sharp";
import { isPhotoPayload, MAX_PHOTO_BYTES, PHOTO_MAX_EDGE } from "./photo-input";

export class PhotoValidationError extends Error {
  constructor() { super("invalid_photo"); this.name = "PhotoValidationError"; }
}

export async function normalizePhoto(base64: unknown): Promise<Buffer> {
  if (!isPhotoPayload(base64)) throw new PhotoValidationError();
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length > MAX_PHOTO_BYTES || bytes.toString("base64") !== base64) throw new PhotoValidationError();
  try {
    const image = sharp(bytes, { limitInputPixels: 24_000_000, failOn: "warning", animated: true });
    const metadata = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) !== 1 || !metadata.width || !metadata.height) throw new PhotoValidationError();
    // Rotation applies EXIF orientation before resize. Re-encoding strips metadata.
    return await image.rotate().resize({ width: PHOTO_MAX_EDGE, height: PHOTO_MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" }).jpeg({ quality: 90 }).toBuffer();
  } catch { throw new PhotoValidationError(); }
}
