import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import { prepareAndroidPhoto, prepareIosPhoto } from "../../modules/doodle-photo";
import { MAX_PHOTO_BYTES, MAX_PHOTO_SOURCE_BYTES, MAX_PHOTO_SOURCE_PIXELS, PHOTO_MAX_EDGE, photoByteLength } from "../../../src/lib/generation/photo-input";

export interface NativePhotoDraft { uri: string; base64: string }

export function removePhotoFile(photo: NativePhotoDraft | null) {
  const cachePrefix = `${Paths.cache.uri.replace(/\/$/, "")}/`;
  if (!photo?.uri.startsWith(cachePrefix)) return;
  try { const file = new File(photo.uri); if (file.exists) file.delete(); } catch {}
}

export async function pickPhoto(): Promise<NativePhotoDraft | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: false, allowsMultipleSelection: false, quality: 1, exif: false, base64: false, legacy: false });
  return preparePickedResult(result);
}

// Android may destroy MainActivity while its system picker is in front.
export async function recoverPhoto(claim: () => boolean): Promise<NativePhotoDraft | null> {
  if (Platform.OS !== "android") return null;
  const result = await ImagePicker.getPendingResultAsync();
  if (!result || ("canceled" in result && result.canceled)) return null;
  if (!claim()) {
    if ("assets" in result && result.assets?.[0]) removePhotoFile({ uri: result.assets[0].uri, base64: "" });
    return null;
  }
  if ("code" in result) throw new Error("invalid");
  return preparePickedResult(result);
}

async function preparePickedResult(result: ImagePicker.ImagePickerResult): Promise<NativePhotoDraft | null> {
  if (result.canceled) return null;
  const asset = result.assets[0];
  let context: ReturnType<typeof ImageManipulator.manipulate> | undefined;
  let normalized: NativePhotoDraft | null = null;
  try {
    if (!asset || asset.type === "video" || !Number.isFinite(asset.width) || !Number.isFinite(asset.height) || asset.width <= 0 || asset.height <= 0) throw new Error("invalid");
    const sourceBytes = Platform.OS === "ios" ? 128_000_000 : MAX_PHOTO_SOURCE_BYTES;
    if ((asset.fileSize ?? 0) > sourceBytes || asset.width * asset.height > MAX_PHOTO_SOURCE_PIXELS) throw new Error("tooLarge");
    if (Platform.OS === "ios") {
      normalized = await prepareIosPhoto(asset.uri, sourceBytes, MAX_PHOTO_SOURCE_PIXELS, PHOTO_MAX_EDGE, MAX_PHOTO_BYTES);
      return normalized;
    }
    if (Platform.OS === "android") {
      normalized = await prepareAndroidPhoto(asset.uri, MAX_PHOTO_SOURCE_BYTES, MAX_PHOTO_SOURCE_PIXELS, PHOTO_MAX_EDGE, MAX_PHOTO_BYTES);
      return normalized;
    }
    if (asset.width * asset.height > 24_000_000) throw new Error("tooLarge");
    context = ImageManipulator.manipulate(asset.uri);
    if (Math.max(asset.width, asset.height) > PHOTO_MAX_EDGE) context.resize(asset.width >= asset.height ? { width: PHOTO_MAX_EDGE } : { height: PHOTO_MAX_EDGE });
    const rendered = await context.renderAsync();
    try {
      // WebP preserves transparency until the server composites onto white.
      const image = await rendered.saveAsync({ format: SaveFormat.WEBP, compress: 0.9, base64: false });
      normalized = { uri: image.uri, base64: "" };
      const file = new File(image.uri);
      if (file.size > MAX_PHOTO_BYTES) throw new Error("tooLarge");
      normalized.base64 = await file.base64();
      if (!normalized.base64 || photoByteLength(normalized.base64) > MAX_PHOTO_BYTES) throw new Error("tooLarge");
      return normalized;
    } finally { rendered.release(); }
  } catch (error) {
    removePhotoFile(normalized);
    if (error && typeof error === "object" && "code" in error && error.code === "ERR_PHOTO_TOO_LARGE") throw new Error("tooLarge");
    throw error;
  }
  finally {
    context?.release();
    if (asset?.uri && asset.uri !== normalized?.uri) removePhotoFile({ uri: asset.uri, base64: "" });
  }
}
