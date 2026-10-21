import { File, Paths } from "expo-file-system";
import * as MediaLibrary from "expo-media-library/legacy";
import * as Sharing from "expo-sharing";
import { randomUUID } from "expo-crypto";
import { Platform } from "react-native";
import { NativeMediaService, type NativeMediaOptions } from "../services/media";
import type { NativeDiagnosticsSink } from "../services/diagnostics";

function options(diagnostics?: NativeDiagnosticsSink): NativeMediaOptions {
  return {
    fileFactory: (filename) => new File(Paths.cache, filename),
    randomId: randomUUID,
    requestPermission: async () => MediaLibrary.requestPermissionsAsync(true, ["photo"]),
    // Returning a PHAsset on iOS reads the library after saving. Use the
    // write-only API because Doodle only needs to save its local image.
    saveAsset: (uri) => Platform.OS === "ios"
      ? MediaLibrary.saveToLibraryAsync(uri)
      : MediaLibrary.createAssetAsync(uri),
    sharingAvailable: Sharing.isAvailableAsync,
    shareFile: (uri) => Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: "Share doodle" }),
    diagnostics,
  };
}

export function createNativeMedia(diagnostics?: NativeDiagnosticsSink): NativeMediaService {
  return new NativeMediaService(options(diagnostics));
}

