import Constants from "expo-constants";
import * as Application from "expo-application";
import { isNativeFixtureMode } from "./fixture-gate";

export interface NativeRuntimeConfig {
  apiBaseUrl: string;
  googleWebClientId: string | null;
  integrityCloudProjectNumber: string | null;
  fixtureMode: boolean;
}

const DEFAULT_API_BASE_URL = "https://doodle.samistudio.nl";
const DEFAULT_GOOGLE_WEB_CLIENT_ID = "368967912119-eg869v0671g2kvg215l1ru91n1p1ihsn.apps.googleusercontent.com";
const DEFAULT_INTEGRITY_CLOUD_PROJECT_NUMBER = "368967912119";

export function getNativeRuntimeConfig(): NativeRuntimeConfig {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const apiBaseUrl = typeof extra.apiBaseUrl === "string" && extra.apiBaseUrl.trim() ? extra.apiBaseUrl.trim() : DEFAULT_API_BASE_URL;
  const configuredGoogleWebClientId = typeof extra.googleWebClientId === "string" ? extra.googleWebClientId.trim() : "";
  const googleWebClientId = configuredGoogleWebClientId && /^[0-9]+-[^\s]+\.apps\.googleusercontent\.com$/.test(configuredGoogleWebClientId)
    ? configuredGoogleWebClientId
    : DEFAULT_GOOGLE_WEB_CLIENT_ID;
  const configuredIntegrityCloudProjectNumber = typeof extra.integrityCloudProjectNumber === "string" ? extra.integrityCloudProjectNumber.trim() : "";
  const integrityCloudProjectNumber = /^\d+$/.test(configuredIntegrityCloudProjectNumber)
    ? configuredIntegrityCloudProjectNumber
    : DEFAULT_INTEGRITY_CLOUD_PROJECT_NUMBER;
  // Fixture mode is restricted by the actual native application id as well as
  // the explicit build flag. This keeps production and live preview packages
  // fail-closed even if a stale public extra value is present.
  const fixtureMode = isNativeFixtureMode(Application.applicationId, extra.nativeFixtureMode);
  return { apiBaseUrl, googleWebClientId, integrityCloudProjectNumber, fixtureMode };
}

export function assertNativeRuntimeConfig(config: NativeRuntimeConfig): void {
  if (!/^https:\/\//i.test(config.apiBaseUrl)) throw new Error("Native API must use HTTPS");
  if (!config.googleWebClientId || !/^[0-9]+-[^\s]+\.apps\.googleusercontent\.com$/.test(config.googleWebClientId)) {
    throw new Error("Native Google web client ID is not configured");
  }
  if (!config.integrityCloudProjectNumber || !/^\d+$/.test(config.integrityCloudProjectNumber)) {
    throw new Error("Native Play Integrity project number is not configured");
  }
}
