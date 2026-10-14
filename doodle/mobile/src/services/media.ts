import type { NativeMedia } from "../contracts/native";
import { NativeServiceError } from "./errors";
import type { NativeDiagnosticsSink } from "./diagnostics";

export interface StagedFile {
  uri: string;
  write(bytes: Uint8Array): void | Promise<void>;
}

export interface NativeMediaOptions {
  fileFactory: (filename: string) => StagedFile;
  randomId: () => string;
  requestPermission: () => Promise<{ granted: boolean }>;
  saveAsset: (uri: string) => Promise<unknown>;
  sharingAvailable: () => Promise<boolean>;
  shareFile: (uri: string) => Promise<void>;
  diagnostics?: NativeDiagnosticsSink;
}

export class NativeMediaService implements NativeMedia {
  private readonly fileFactory: (filename: string) => StagedFile;
  private readonly randomId: () => string;
  private readonly requestPermission: () => Promise<{ granted: boolean }>;
  private readonly saveAsset: (uri: string) => Promise<unknown>;
  private readonly sharingAvailable: () => Promise<boolean>;
  private readonly shareFile: (uri: string) => Promise<void>;
  private readonly diagnostics?: NativeDiagnosticsSink;

  constructor(options: NativeMediaOptions) {
    this.fileFactory = options.fileFactory;
    this.randomId = options.randomId;
    this.requestPermission = options.requestPermission;
    this.saveAsset = options.saveAsset;
    this.sharingAvailable = options.sharingAvailable;
    this.shareFile = options.shareFile;
    this.diagnostics = options.diagnostics;
  }

  async stagePng(bytes: ArrayBuffer): Promise<string> {
    if (bytes.byteLength === 0) {
      throw new NativeServiceError("media_unavailable");
    }
    try {
      const file = this.fileFactory(`doodle-${this.randomId()}.png`);
      await file.write(new Uint8Array(bytes));
      return file.uri;
    } catch {
      throw new NativeServiceError("media_unavailable");
    }
  }

  async download(uri: string): Promise<void> {
    const startedAt = Date.now();
    if (!isLocalFileUri(uri)) {
      this.record("media_save", "media_unavailable", startedAt);
      throw new NativeServiceError("media_unavailable");
    }
    let permission: { granted: boolean };
    try {
      permission = await this.requestPermission();
    } catch {
      this.record("media_save", "media_unavailable", startedAt);
      throw new NativeServiceError("media_unavailable");
    }
    if (!permission.granted) {
      throw new NativeServiceError("media_unavailable");
    }
    try {
      await this.saveAsset(uri);
    } catch {
      this.record("media_save", "media_unavailable", startedAt);
      throw new NativeServiceError("media_unavailable");
    }
  }

  async share(uri: string): Promise<void> {
    const startedAt = Date.now();
    if (!isLocalFileUri(uri)) {
      this.record("media_share", "media_unavailable", startedAt);
      throw new NativeServiceError("media_unavailable");
    }
    let available = false;
    try {
      available = await this.sharingAvailable();
    } catch {
      this.record("media_share", "media_unavailable", startedAt);
      throw new NativeServiceError("media_unavailable");
    }
    if (!available) {
      this.record("media_share", "media_unavailable", startedAt);
      throw new NativeServiceError("media_unavailable");
    }
    try {
      await this.shareFile(uri);
    } catch {
      this.record("media_share", "media_unavailable", startedAt);
      throw new NativeServiceError("media_unavailable");
    }
  }

  private record(stage: "media_save" | "media_share", code: unknown, startedAt: number): void {
    try {
      void Promise.resolve(this.diagnostics?.record({ operation: "media", stage, code, durationMs: boundedDuration(Date.now() - startedAt) })).catch(() => undefined);
    } catch {
      // Diagnostics must never change the media result.
    }
  }
}

function isLocalFileUri(uri: string): boolean {
  return /^(?:file|content):\/\//i.test(uri);
}

function boundedDuration(value: number): number {
  return Number.isSafeInteger(value) && value >= 0 ? Math.min(value, 190_000) : 0;
}
