import * as Application from "expo-application";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { randomUUID } from "./crypto";
import {
  NativeDiagnostics,
  type NativeDiagnosticsMetadata,
  type NativeDiagnosticsStorage,
} from "../services/diagnostics";

export interface NativeDiagnosticsFile {
  readonly uri: string;
  readonly exists: boolean;
  text(): Promise<string>;
  write(value: string): Promise<void> | void;
  delete(): Promise<void> | void;
}

export interface NativeDiagnosticsPlatformOptions {
  storage?: NativeDiagnosticsStorage;
  exportFile?: NativeDiagnosticsFile;
  share?: (uri: string, options: { mimeType: string; dialogTitle: string }) => Promise<void>;
  uuid?: () => string;
  metadata?: NativeDiagnosticsMetadata;
  now?: () => number;
}

export interface NativeDiagnosticsRuntime {
  diagnostics: NativeDiagnostics;
  exportAndShare(dialogTitle?: string): Promise<void>;
  clear(): Promise<void>;
}

const DIAGNOSTICS_FILENAME = "doodle-diagnostics.json";
const DIAGNOSTICS_EXPORT_FILENAME = "doodle-diagnostics-export.json";

export function createNativeDiagnostics(options: NativeDiagnosticsPlatformOptions = {}): NativeDiagnosticsRuntime {
  const uuid = options.uuid ?? randomUUID;
  const metadata = options.metadata ?? nativeDiagnosticsMetadata();
  const storage = options.storage ?? new ExpoDiagnosticsStorage(new File(Paths.document, DIAGNOSTICS_FILENAME));
  const diagnostics = new NativeDiagnostics({ storage, metadata, uuid, now: options.now });
  const share = options.share ?? ((uri, shareOptions) => Sharing.shareAsync(uri, shareOptions));
  let exportQueue = Promise.resolve();

  return {
    diagnostics,
    async exportAndShare(dialogTitle = "Send Doodle diagnostics") {
      const task = exportQueue.then(async () => {
        const exportFile = options.exportFile ?? new File(Paths.cache, DIAGNOSTICS_EXPORT_FILENAME);
        await exportFile.write(await diagnostics.exportPayload());
        await share(exportFile.uri, { mimeType: "application/json", dialogTitle });
      });
      exportQueue = task.catch(() => undefined);
      return task;
    },
    clear: () => diagnostics.clear(),
  };
}

class ExpoDiagnosticsStorage implements NativeDiagnosticsStorage {
  constructor(private readonly file: NativeDiagnosticsFile) {}

  async read(): Promise<string | null> {
    if (!this.file.exists) return null;
    return this.file.text();
  }

  async write(value: string): Promise<void> {
    await this.file.write(value);
  }

  async clear(): Promise<void> {
    if (this.file.exists) await this.file.delete();
  }
}

function nativeDiagnosticsMetadata(): NativeDiagnosticsMetadata {
  const androidApi = typeof Platform.Version === "number"
    ? Platform.Version
    : Number.parseInt(String(Platform.Version), 10);
  return {
    appVersion: Application.nativeApplicationVersion ?? "0.0.0",
    build: Application.nativeBuildVersion ?? "0",
    androidApi: Number.isSafeInteger(androidApi) ? androidApi : 1,
  };
}
