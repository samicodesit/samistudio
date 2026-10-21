import { type PaperColorId } from "../../../src/lib/generation/paper-colors";
import type { PlayCatalog, PlayPackId, PlayPack } from "../../../src/lib/billing/play-catalog";
export type { PlayCatalog, PlayPackId, PlayPack };
export type NativePricedPack = PlayPack & {priceLabel:string;price:number;priceMicros:number;currency:string};
export type NativePackCatalog = Omit<PlayCatalog,"packs"> & {packs:NativePricedPack[]};
export type NativeCheckoutIntent = PlayPack & {obfuscatedAccountId:string;obfuscatedProfileId:string};
export type NativeAppleCheckoutIntent = PlayPack & {appAccountToken:string};
export interface NativeApplePurchaseApi {
  getAppleCatalog(): Promise<PlayCatalog>;
  createAppleIntent(productId: PlayPackId, expectedCredits: number): Promise<NativeAppleCheckoutIntent>;
  verifyApplePurchase(transactionId: string): Promise<NativePlayVerifyResponse>;
}
import type { DetailLevel } from "../../../src/lib/generation/detail-level";
export const NATIVE_ORIGIN = "https://doodle.samistudio.nl" as const;
export const NATIVE_CLIENT = "native-android" as const;
export const NATIVE_IOS_CLIENT = "native-ios" as const;
export const NATIVE_PACKAGE_NAME = "nl.samistudio.doodle" as const;
export const NATIVE_PRODUCT_ID = "doodle_credits_10" as const;
export const NATIVE_MINIMUM_VERSION_CODE = 2 as const;
export const MAX_SCENE_LENGTH = 180 as const;

export interface NativeAndroidConfigResponse {
  enabled: boolean;
  packageName: typeof NATIVE_PACKAGE_NAME;
  minimumVersionCode: typeof NATIVE_MINIMUM_VERSION_CODE;
  attestation: "play_integrity";
  guestEnabled: boolean;
  cloudProjectNumber?: string;
}
export interface NativeIosConfigResponse {
  enabled: boolean;
  packageName: typeof NATIVE_PACKAGE_NAME;
  minimumBuild: "1";
  attestation: "app_attest";
  guestEnabled: boolean;
  environment: "development" | "production";
}
export type NativeConfigResponse = NativeAndroidConfigResponse | NativeIosConfigResponse;

export interface NativeGoogleResponse {
  authenticated: true;
  email: string;
  accessToken: string;
  expiresAt: number;
}

export type NativeAuthProvider = "google" | "apple";
export interface NativeAppleCredentials { identityToken: string; authorizationCode: string; nonce: string }
export interface NativeAppleResponse {
  authenticated: true;
  provider: "apple";
  email: string | null;
  accessToken: string;
  expiresAt: number;
}
export type NativeAuthResponse = NativeGoogleResponse | NativeAppleResponse;

export interface NativeChallengeResponse {
  challenge: string;
  requestHash: string;
  expiresAt: number;
  keyScope?: string;
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
  hasPurchased?: boolean | null;
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
  productId?: string;
  creditsGranted?: number;
  offerApplied?: boolean;
  checkoutReference?: string;
}

export interface NativeApi {
  recordPaywall?(trigger: "tapped_create" | "get_more"): Promise<void>;
  getConfig(): Promise<NativeConfigResponse>;
  signInWithGoogle(credential: string): Promise<NativeGoogleResponse>;
  signInWithApple(input: NativeAppleCredentials): Promise<NativeAppleResponse>;
  signOut(): Promise<void>;
  getAccount(): Promise<AccountSummary>;
  getTrialAccount(): Promise<AccountSummary>;
  deleteAccount(): Promise<void>;
  createGuestSession(installId: string): Promise<NativeGuestSessionResponse>;
  generate(scene: string, detailLevel?: DetailLevel, photo?: string, paperColor?: PaperColorId): Promise<NativeGenerationResult>;
}

export interface NativePurchaseApi {
  getPlayCatalog?(): Promise<PlayCatalog>;
  createPlayIntent?(productId:PlayPackId,expectedCredits:number):Promise<NativeCheckoutIntent>;
  getPlayConfig(): Promise<NativePlayConfig>;
  verifyPlayPurchase(input: { productId: string; purchaseToken: string }): Promise<NativePlayVerifyResponse>;
}

export interface NativeBilling {
  resetAccount?(): void;
  getPendingPack?(): PlayPackId | null;
  subscribeGrants?(listener: (grant: NativePlayVerifyResponse) => void): () => void;
  preparePacks(): Promise<NativePackCatalog>;
  buyPack(productId: PlayPackId, expectedCredits: number): Promise<NativePlayVerifyResponse>;
  recoverPacks(): Promise<void>;
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

export function isNativeConfig(value: unknown): value is NativeConfigResponse {
  if (!value || typeof value !== "object") return false;
  const config = value as Partial<NativeConfigResponse>;
  return (
    config.packageName === NATIVE_PACKAGE_NAME &&
    typeof config.enabled === "boolean" &&
    typeof config.guestEnabled === "boolean" &&
    ((config.attestation === "play_integrity" && config.minimumVersionCode === NATIVE_MINIMUM_VERSION_CODE && (!config.cloudProjectNumber || /^\d+$/.test(config.cloudProjectNumber))) ||
     (config.attestation === "app_attest" && config.minimumBuild === "1" && (config.environment === "production" || config.environment === "development")))
  );
}
