import type { NativeLocale } from "../ui/types";

export const NATIVE_ORIGIN = "https://doodle.samistudio.nl" as const;
export const NATIVE_CLIENT = "native-android" as const;
export const NATIVE_PACKAGE_NAME = "nl.samistudio.doodle" as const;
export const NATIVE_PRODUCT_ID = "doodle_credits_10" as const;
export const NATIVE_MINIMUM_VERSION_CODE = 2 as const;
export const MAX_SCENE_LENGTH = 180 as const;

export type NativeOperation = "guest" | "generate";

export interface NativeConfigResponse {
  enabled: boolean;
  packageName: typeof NATIVE_PACKAGE_NAME;
  minimumVersionCode: typeof NATIVE_MINIMUM_VERSION_CODE;
  attestation: "play_integrity";
  guestEnabled: boolean;
  cloudProjectNumber?: string;
}

export interface NativeGoogleResponse {
  authenticated: true;
  email: string;
  accessToken: string;
  expiresAt: number;
}

export interface NativeChallengeResponse {
  challenge: string;
  requestHash: string;
  expiresAt: number;
}

export interface NativeGuestSessionResponse {
  trialToken: string;
  expiresAt: number;
  freeRemaining: number;
}

export interface AccountSummary {
  authenticated: boolean;
  email: string | null;
  balance: number;
  freeRemaining: number | null;
}

export interface NativeGenerationResult {
  imageUri: string;
  freeRemaining?: number;
  paidRemaining?: number;
}

export interface NativePlayConfig {
  enabled: true;
  productId: typeof NATIVE_PRODUCT_ID;
  obfuscatedAccountId: string;
}

export type NativePlayVerifyStatus = "granted" | "already_granted" | "granted_consume_pending";

export interface NativePlayVerifyResponse {
  status: NativePlayVerifyStatus;
  balance: number;
}

export interface NativeApi {
  getConfig(): Promise<NativeConfigResponse>;
  signInWithGoogle(credential: string): Promise<NativeGoogleResponse>;
  signOut(): Promise<void>;
  getAccount(): Promise<AccountSummary>;
  getTrialAccount(): Promise<AccountSummary>;
  deleteAccount(): Promise<void>;
  createGuestSession(installId: string): Promise<NativeGuestSessionResponse>;
  generate(scene: string): Promise<NativeGenerationResult>;
}

export interface NativePurchaseApi {
  getPlayConfig(): Promise<NativePlayConfig>;
  verifyPlayPurchase(input: { productId: typeof NATIVE_PRODUCT_ID; purchaseToken: string }): Promise<NativePlayVerifyResponse>;
}

export interface NativeBilling {
  prepare(): Promise<{ productId: typeof NATIVE_PRODUCT_ID; priceLabel: string }>;
  buy(): Promise<void>;
  recoverPending(): Promise<void>;
  dispose(): Promise<void>;
}

export interface NativeMedia {
  stagePng(bytes: ArrayBuffer): Promise<string>;
  download(uri: string): Promise<void>;
  share(uri: string): Promise<void>;
}

export interface NativeAttestation {
  prepare(): Promise<void>;
  request(requestHash: string): Promise<string>;
}

export interface NativeReportApi {
  submitReport(input: {
    locale: NativeLocale;
    report: { reason: string; details: string; includeContent: boolean };
    scene?: string;
    imageUri?: string;
  }): Promise<{ id: string }>;
}

export function isNativeConfig(value: unknown): value is NativeConfigResponse {
  if (!value || typeof value !== "object") return false;
  const config = value as Partial<NativeConfigResponse>;
  return (
    config.packageName === NATIVE_PACKAGE_NAME &&
    config.minimumVersionCode === NATIVE_MINIMUM_VERSION_CODE &&
    config.attestation === "play_integrity" &&
    typeof config.enabled === "boolean" &&
    typeof config.guestEnabled === "boolean" &&
    (!config.cloudProjectNumber || /^\d+$/.test(config.cloudProjectNumber))
  );
}
