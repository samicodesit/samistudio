import type { NativeGoogleResponse } from "../contracts/native";

export interface NativeSecureStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
}

export const NATIVE_STORAGE_KEYS = {
  access: "doodle.native.access",
  trial: "doodle.native.trial",
  install: "doodle.native.install",
  locale: "doodle.native.locale",
} as const;

const ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TRIAL_TOKEN_PATTERN = /^[A-Za-z0-9._-]{20,4096}$/;

type PersistedAccess = { accessToken: string; expiresAt: number };

export interface SessionStoreOptions {
  storage: NativeSecureStorage;
  now?: () => number;
  randomUuid?: () => string;
}

export class NativeSessionStore {
  private readonly now: () => number;
  private readonly randomUuid: () => string;

  constructor(private readonly storage: NativeSecureStorage, options: Omit<SessionStoreOptions, "storage"> = {}) {
    this.now = options.now ?? Date.now;
    this.randomUuid = options.randomUuid ?? (() => {
      const uuid = globalThis.crypto?.randomUUID?.();
      if (!uuid) throw new Error("Could not create a native installation id");
      return uuid;
    });
  }

  async getAccessToken(): Promise<string | null> {
    const raw = await this.storage.getItem(NATIVE_STORAGE_KEYS.access);
    if (!raw) return null;
    try {
      const value = JSON.parse(raw) as Partial<PersistedAccess>;
      if (
        typeof value.accessToken !== "string" ||
        !ACCESS_TOKEN_PATTERN.test(value.accessToken) ||
        typeof value.expiresAt !== "number" ||
        !Number.isSafeInteger(value.expiresAt) ||
        value.expiresAt <= this.now()
      ) {
        await this.clearAccessToken();
        return null;
      }
      return value.accessToken;
    } catch {
      await this.clearAccessToken();
      return null;
    }
  }

  async setAccessToken(response: Pick<NativeGoogleResponse, "accessToken" | "expiresAt">): Promise<void> {
    if (!ACCESS_TOKEN_PATTERN.test(response.accessToken) || !Number.isSafeInteger(response.expiresAt) || response.expiresAt <= this.now()) {
      throw new Error("Invalid native access session");
    }
    await this.storage.setItem(NATIVE_STORAGE_KEYS.access, JSON.stringify(response));
  }

  async clearAccessToken(): Promise<void> {
    await this.storage.deleteItem(NATIVE_STORAGE_KEYS.access);
  }

  async getTrialToken(): Promise<string | null> {
    const value = await this.storage.getItem(NATIVE_STORAGE_KEYS.trial);
    return value && TRIAL_TOKEN_PATTERN.test(value) ? value : null;
  }

  async setTrialToken(value: string): Promise<void> {
    if (!TRIAL_TOKEN_PATTERN.test(value)) throw new Error("Invalid native trial token");
    await this.storage.setItem(NATIVE_STORAGE_KEYS.trial, value);
  }

  async clearTrialToken(): Promise<void> {
    await this.storage.deleteItem(NATIVE_STORAGE_KEYS.trial);
  }

  async getInstallId(): Promise<string> {
    const existing = await this.storage.getItem(NATIVE_STORAGE_KEYS.install);
    if (existing && UUID_PATTERN.test(existing)) return existing.toLowerCase();

    const installId = this.randomUuid().toLowerCase();
    if (!UUID_PATTERN.test(installId)) throw new Error("Could not create a native installation id");
    await this.storage.setItem(NATIVE_STORAGE_KEYS.install, installId);
    return installId;
  }

  async getLocale(): Promise<string | null> {
    return this.storage.getItem(NATIVE_STORAGE_KEYS.locale);
  }

  async setLocale(locale: string): Promise<void> {
    await this.storage.setItem(NATIVE_STORAGE_KEYS.locale, locale);
  }
}
