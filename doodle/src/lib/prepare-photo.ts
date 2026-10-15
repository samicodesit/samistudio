import { imageDimensionsFromStream } from "image-dimensions";
import { orientation } from "exifr/dist/mini.esm.mjs";
import { MAX_PHOTO_BYTES, MAX_PHOTO_SOURCE_BYTES, MAX_PHOTO_SOURCE_PIXELS, PHOTO_MAX_EDGE, photoByteLength } from "./generation/photo-input";
export interface PhotoDraft { base64: string; uri: string }

export async function preparePhoto(file: File): Promise<PhotoDraft> {
  if (file.size > MAX_PHOTO_SOURCE_BYTES) throw new Error("tooLarge");
  if (!file.size) throw new Error("invalid");
  // Inspect bytes before allocating pixels. MIME and the filename are only hints.
  const dimensions = await imageDimensionsFromStream(file.stream());
  if (!dimensions || dimensions.type === "gif") throw new Error("invalid");
  const { width, height, type } = dimensions;
  const pixels = width * height;
  if (!width || !height || pixels > MAX_PHOTO_SOURCE_PIXELS) throw new Error("tooLarge");
  let resize: ImageBitmapOptions = {};
  if (type === "jpeg") {
    // Resize is applied after EXIF orientation. Read only orientation, never GPS.
    const swapped = (await orientation(file) ?? 1) >= 5;
    const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(width, height));
    resize = { resizeWidth: Math.max(1, Math.round((swapped ? height : width) * scale)), resizeHeight: Math.max(1, Math.round((swapped ? width : height) * scale)), resizeQuality: "high" };
  } else if (pixels > 24_000_000) {
    // Other containers can carry their own rotation. Let the browser orient them
    // before fitting; use a tighter bound when a full decode may be necessary.
    throw new Error("tooLarge");
  }
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image", ...resize });
  const canvas = document.createElement("canvas");
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > MAX_PHOTO_SOURCE_PIXELS) throw new Error("tooLarge");
    const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("invalid");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const uri = canvas.toDataURL("image/jpeg", 0.9);
    const base64 = uri.startsWith("data:image/jpeg;base64,") ? uri.slice(23) : "";
    if (!base64) throw new Error("invalid");
    if (photoByteLength(base64) > MAX_PHOTO_BYTES) throw new Error("tooLarge");
    return { base64, uri };
  } finally { bitmap.close(); canvas.width = 0; canvas.height = 0; }
}
