import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { File, Paths } from "expo-file-system";
import { MAX_PHOTO_BYTES, PHOTO_MAX_EDGE } from "../../../src/lib/generation/photo-input";

export interface NativePhotoDraft { uri: string; base64: string }

export function removePhotoFile(photo: NativePhotoDraft | null) {
  if (!photo?.uri.startsWith(Paths.cache.uri)) return;
  try { const file = new File(photo.uri); if (file.exists) file.delete(); } catch {}
}

export async function pickPhoto(): Promise<NativePhotoDraft | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: false, allowsMultipleSelection: false, quality: 1, exif: false, base64: false, legacy: false });
  if (result.canceled) return null;
  const asset = result.assets[0];
  let context: ReturnType<typeof ImageManipulator.manipulate> | undefined;
  let normalized: NativePhotoDraft | null = null;
  try {
    if (!asset || asset.type === "video" || !asset.width || !asset.height) throw new Error("invalid");
    if ((asset.fileSize ?? 0) > 20_000_000 || asset.width * asset.height > 24_000_000) throw new Error("tooLarge");
    context = ImageManipulator.manipulate(asset.uri);
    if (Math.max(asset.width, asset.height) > PHOTO_MAX_EDGE) context.resize(asset.width >= asset.height ? { width: PHOTO_MAX_EDGE } : { height: PHOTO_MAX_EDGE });
    const rendered = await context.renderAsync();
    try {
      const image = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.9, base64: true });
      normalized = { uri: image.uri, base64: image.base64 ?? "" };
      if (!normalized.base64 || normalized.base64.length * 0.75 > MAX_PHOTO_BYTES) throw new Error("tooLarge");
      return normalized;
    } finally { rendered.release(); }
  } catch (error) { removePhotoFile(normalized); throw error; }
  finally {
    context?.release();
    if (asset?.uri && asset.uri !== normalized?.uri) removePhotoFile({ uri: asset.uri, base64: "" });
  }
}
