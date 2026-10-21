import { File, Paths } from "expo-file-system";
import * as MediaLibrary from "expo-media-library/legacy";
import * as Sharing from "expo-sharing";
import { randomUUID } from "expo-crypto";
import { NativeMediaService, type NativeMediaOptions } from "../services/media";
import type { NativeDiagnosticsSink } from "../services/diagnostics";

function options(diagnostics?: NativeDiagnosticsSink): NativeMediaOptions {
  return {
    fileFactory: (filename) => new File(Paths.cache, filename),
    randomId: randomUUID,
    requestPermission: async () => MediaLibrary.requestPermissionsAsync(true, ["photo"]),
    saveAsset: (uri) => MediaLibrary.createAssetAsync(uri),
    sharingAvailable: Sharing.isAvailableAsync,
    shareFile: (uri) => Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: "Share doodle" }),
    diagnostics,
  };
}

export function createNativeMedia(diagnostics?: NativeDiagnosticsSink): NativeMediaService {
  return new NativeMediaService(options(diagnostics));
}

