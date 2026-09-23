import { NativeApiClient } from "../services/api-client";
import { GoogleAuthService } from "../services/auth";
import { NativeBillingService } from "../services/billing";
import { NativeReportService } from "../services/report";
import { NativeSessionStore } from "../services/session-store";
import { createNativeMedia } from "../platform/media";
import type { NativeMediaService } from "../services/media";
import { createNativeReportService } from "../platform/report";
import { appIntegrityModule, createNativeAttestation } from "../platform/app-integrity";
import { expoIapModule } from "../platform/iap";
import { googleSignInModule } from "../platform/google-sign-in";
import { randomUUID, sha256Hex } from "../platform/crypto";
import { secureStore } from "../platform/secure-store";
import { assertNativeRuntimeConfig, getNativeRuntimeConfig, type NativeRuntimeConfig } from "../platform/runtime-config";
import { Platform } from "react-native";

export interface NativeRuntime {
  config: NativeRuntimeConfig;
  session: NativeSessionStore;
  api: NativeApiClient;
  auth: GoogleAuthService;
  billing: NativeBillingService;
  media: NativeMediaService;
  reports: NativeReportService;
}

export function createNativeRuntime(config = getNativeRuntimeConfig()): NativeRuntime {
  assertNativeRuntimeConfig(config);
  const platform = Platform.OS === "android" ? "android" : "ios";
  const session = new NativeSessionStore(secureStore, { randomUuid: randomUUID });
  const media = createNativeMedia();
  // Play Integrity and the Play consumable flow are Android-only in this
  // release. The iOS runtime is intentionally fail-closed until its native
  // attestation and StoreKit contracts are implemented.
  const attestation = createNativeAttestation(platform === "android" ? config.integrityCloudProjectNumber : null, appIntegrityModule);
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
    hashScene: sha256Hex,
  });
  const auth = new GoogleAuthService({ google: googleSignInModule, webClientId: config.googleWebClientId, signInWithGoogle: (credential) => api.signInWithGoogle(credential) });
  const billing = new NativeBillingService({ iap: expoIapModule, api, platform });
  const reports = createNativeReportService((payload) => api.submitReport(payload));
  return { config, session, api, auth, billing, media, reports };
}
