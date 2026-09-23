import type { NativeMedia } from "../contracts/native";
import { NativeServiceError } from "./errors";

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
}

export class NativeMediaService implements NativeMedia {
  private readonly fileFactory: (filename: string) => StagedFile;
  private readonly randomId: () => string;
  private readonly requestPermission: () => Promise<{ granted: boolean }>;
  private readonly saveAsset: (uri: string) => Promise<unknown>;
  private readonly sharingAvailable: () => Promise<boolean>;
  private readonly shareFile: (uri: string) => Promise<void>;

  constructor(options: NativeMediaOptions) {
    this.fileFactory = options.fileFactory;
    this.randomId = options.randomId;
    this.requestPermission = options.requestPermission;
    this.saveAsset = options.saveAsset;
    this.sharingAvailable = options.sharingAvailable;
    this.shareFile = options.shareFile;
  }

  async stagePng(bytes: ArrayBuffer): Promise<string> {
    if (bytes.byteLength === 0) throw new NativeServiceError("media_unavailable");
    const file = this.fileFactory(`doodle-${this.randomId()}.png`);
    await file.write(new Uint8Array(bytes));
    return file.uri;
  }

  async download(uri: string): Promise<void> {
    if (!isLocalFileUri(uri)) throw new NativeServiceError("media_unavailable");
    const permission = await this.requestPermission();
    if (!permission.granted) throw new NativeServiceError("media_unavailable");
    try {
      await this.saveAsset(uri);
    } catch {
      throw new NativeServiceError("media_unavailable");
    }
  }

  async share(uri: string): Promise<void> {
    if (!isLocalFileUri(uri)) throw new NativeServiceError("media_unavailable");
    let available = false;
    try {
      available = await this.sharingAvailable();
    } catch {
      throw new NativeServiceError("media_unavailable");
    }
    if (!available) throw new NativeServiceError("media_unavailable");
    try {
      await this.shareFile(uri);
    } catch {
      throw new NativeServiceError("media_unavailable");
    }
  }
}

function isLocalFileUri(uri: string): boolean {
  return /^(?:file|content):\/\//i.test(uri);
}
