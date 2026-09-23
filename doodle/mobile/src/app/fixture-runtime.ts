import { Asset } from "expo-asset";
import { NATIVE_REFERENCE_IMAGE } from "../platform/assets";
import { NATIVE_PRODUCT_ID, type NativeApi, type NativeBilling, type NativeConfigResponse, type NativeGenerationResult, type NativeGoogleResponse } from "../contracts/native";
import type { GoogleAuthService } from "../services/auth";
import { NativeServiceError } from "../services/errors";
import { NativeReportService } from "../services/report";

type FixtureAuth = Pick<GoogleAuthService, "signIn" | "signOut">;

export interface FrontendFixtureServices {
  api: NativeApi;
  auth: FixtureAuth;
  billing: NativeBilling;
  reports: NativeReportService;
}

export interface FrontendFixtureOptions {
  generationDelayMs?: number;
}

type FixtureState = {
  signedIn: boolean;
  balance: number;
  freeRemaining: number;
};

/**
 * Isolated presentation fixture. The caller must pass the runtime's explicit
 * package-and-flag gate. It never reports an enabled server, account, trial,
 * or purchase entitlement to production services.
 */
export function createFrontendFixtureServices(enabled = false, options: FrontendFixtureOptions = {}): FrontendFixtureServices {
  if (!enabled) throw new Error("Frontend fixture mode is explicitly disabled");

  const state: FixtureState = { signedIn: false, balance: 0, freeRemaining: 2 };
  const generationDelayMs = Math.max(0, options.generationDelayMs ?? 8_000);
  const config: NativeConfigResponse = {
    enabled: false,
    packageName: "nl.samistudio.doodle",
    minimumVersionCode: 2,
    attestation: "play_integrity",
    guestEnabled: false,
  };
  const signedOut = () => ({ authenticated: false, email: null, balance: 0, freeRemaining: state.freeRemaining });
  const signedIn = () => ({ authenticated: true, email: "preview@example.test", balance: state.balance, freeRemaining: state.freeRemaining });
  const googleResponse = (): NativeGoogleResponse => ({
    authenticated: true,
    email: "preview@example.test",
    accessToken: "fixture-access-token",
    expiresAt: Date.now() + 3_600_000,
  });

  const api: NativeApi = {
    async getConfig() { return config; },
    async signInWithGoogle() {
      state.signedIn = true;
      return googleResponse();
    },
    async signOut() { state.signedIn = false; },
    async getAccount() { return state.signedIn ? signedIn() : signedOut(); },
    async getTrialAccount() { return signedOut(); },
    async deleteAccount() {
      state.signedIn = false;
      state.balance = 0;
      state.freeRemaining = 2;
    },
    async createGuestSession() { throw new NativeServiceError("native_generation_unavailable"); },
    async generate(_scene: string): Promise<NativeGenerationResult> {
      // Keep the fixture delay long enough to inspect the waiting state on a device.
      if (generationDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, generationDelayMs));
      const resolved = Asset.fromModule(NATIVE_REFERENCE_IMAGE as number);
      await resolved.downloadAsync();
      const imageUri = resolved.localUri ?? resolved.uri;
      if (!imageUri) throw new NativeServiceError("media_unavailable");
      if (state.signedIn && state.balance > 0) {
        state.balance = Math.max(0, state.balance - 1);
        return { imageUri, paidRemaining: state.balance };
      }
      if (state.freeRemaining > 0) {
        state.freeRemaining = Math.max(0, state.freeRemaining - 1);
        return { imageUri, freeRemaining: state.freeRemaining };
      }
      throw new NativeServiceError("payment_required");
    },
  };

  const auth: FixtureAuth = {
    async signIn() {
      state.signedIn = true;
      return googleResponse();
    },
    async signOut() { state.signedIn = false; },
  };

  const billing: NativeBilling = {
    async prepare() { return { productId: NATIVE_PRODUCT_ID, priceLabel: "€4.99" }; },
    async buy() { state.balance += 10; },
    async recoverPending() {},
    async dispose() {},
  };

  const reports = new NativeReportService({
    async submit() { return { id: "fixture-report" }; },
    async manipulate(uri) {
      return { uri, width: 1, height: 1, base64: "AA==" };
    },
  });

  return { api, auth, billing, reports };
}

export function createFrontendFixtureApi(enabled = false): NativeApi {
  return createFrontendFixtureServices(enabled).api;
}

const defaultFixtureServices = createFrontendFixtureServices(true);

export const fixtureBilling = defaultFixtureServices.billing;
export const fixtureAuth = defaultFixtureServices.auth;
export const fixtureReports = defaultFixtureServices.reports;
