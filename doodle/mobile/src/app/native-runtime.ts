import { NativeApiClient } from "../services/api-client";
import { GoogleAuthService } from "../services/auth";
import { AppleAuthService } from "../services/apple-auth";
import { NativeAuthService, type NativeAuth } from "../services/native-auth";
import { appleSignInModule } from "../platform/apple-sign-in";
import { NativeBillingService } from "../services/billing";
import { AppleBillingService } from "../services/apple-billing";
import type { NativeBilling } from "../contracts/native";
import { NativeReportService } from "../services/report";
import { NativeSessionStore } from "../services/session-store";
import { createNativeMedia } from "../platform/media";
import type { NativeMediaService } from "../services/media";
import { createNativeReportService } from "../platform/report";
import { appIntegrityModule, createNativeAttestation } from "../platform/app-integrity";
import { createAppleAttestation } from "../platform/apple-attestation";
import { expoIapModule } from "../platform/iap";
import { googleSignInModule } from "../platform/google-sign-in";
import { randomNonce, randomUUID, sha256Hex } from "../platform/crypto";
import { secureStore } from "../platform/secure-store";
import { assertNativeRuntimeConfig, getNativeRuntimeConfig, type NativeRuntimeConfig } from "../platform/runtime-config";
import { Platform } from "react-native";
import { NativeIdeasCatalog } from "../services/ideas-catalog";
import { ideasCache } from "../platform/ideas-cache";
import { createNativeDiagnostics } from "../platform/diagnostics";
import type { NativeDiagnosticsRuntime } from "../platform/diagnostics";

export interface NativeRuntime {
  ideas?: NativeIdeasCatalog;
  config: NativeRuntimeConfig;
  session: NativeSessionStore;
  api: NativeApiClient;
  auth: NativeAuth;
  billing: NativeBilling;
  media: NativeMediaService;
  reports: NativeReportService;
  diagnostics: NativeDiagnosticsRuntime;
}

export function createNativeRuntime(config = getNativeRuntimeConfig()): NativeRuntime {
  assertNativeRuntimeConfig(config);
  const platform = Platform.OS === "android" ? "android" : "ios";
  const diagnostics = createNativeDiagnostics();
  const session = new NativeSessionStore(secureStore, { randomUuid: randomUUID });
  const media = createNativeMedia(diagnostics.diagnostics);
  const attestation = createNativeAttestation(platform === "android" ? config.integrityCloudProjectNumber : null, appIntegrityModule, diagnostics.diagnostics);
  const appleAttestation = platform === "ios" ? createAppleAttestation(secureStore, undefined, diagnostics.diagnostics) : undefined;
  const api = new NativeApiClient({
    baseUrl: config.apiBaseUrl,
    platform,
    getAccessToken: () => session.getAccessToken(),
    setAccessToken: (value) => session.setAccessToken(value),
    clearAccessToken: () => session.clearAccessToken(),
    getTrialToken: () => session.getTrialToken(),
    setTrialToken: (value) => session.setTrialToken(value),
    clearTrialToken: () => session.clearTrialToken(),
    getInstallId: () => session.getInstallId(),
    stagePng: (bytes) => media.stagePng(bytes),
    requestIntegrity: (requestHash) => attestation.request(requestHash),
    appleAttestation,
    hashScene: sha256Hex,
    diagnostics: diagnostics.diagnostics,
    requestId: randomUUID,
  });
  const googleAuth = new GoogleAuthService({ google: googleSignInModule, platform, webClientId: config.googleWebClientId, iosClientId: config.googleIosClientId, signInWithGoogle: (credential) => api.signInWithGoogle(credential), diagnostics: diagnostics.diagnostics });
  const appleAuth = platform === "ios" ? new AppleAuthService({ apple: appleSignInModule, randomNonce, sha256: sha256Hex, exchange: input => api.signInWithApple(input) }) : undefined;
  const auth = new NativeAuthService(googleAuth, appleAuth);
  const billing = platform === "ios" ? new AppleBillingService({ iap: expoIapModule, api }) : new NativeBillingService({ iap: expoIapModule, api, platform, diagnostics: diagnostics.diagnostics });
  const reports = createNativeReportService((payload) => api.submitReport(payload));
  const ideas = new NativeIdeasCatalog({ baseUrl: config.apiBaseUrl, cache: ideasCache });
  return { config, session, api, auth, billing, media, reports, diagnostics, ideas };
}
