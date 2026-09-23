import { File, Paths } from "expo-file-system";
import * as MediaLibrary from "expo-media-library/legacy";
import * as Sharing from "expo-sharing";
import { randomUUID } from "expo-crypto";
import { NativeMediaService, type NativeMediaOptions } from "../services/media";

const options: NativeMediaOptions = {
  fileFactory: (filename) => new File(Paths.cache, filename),
  randomId: randomUUID,
  requestPermission: async () => MediaLibrary.requestPermissionsAsync(true, ["photo"]),
  saveAsset: (uri) => MediaLibrary.createAssetAsync(uri),
  sharingAvailable: Sharing.isAvailableAsync,
  shareFile: (uri) => Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: "Share doodle" }),
};

export function createNativeMedia(): NativeMediaService {
  return new NativeMediaService(options);
}
