import { getPlayCatalog } from "../../../src/lib/billing/play-catalog";
import { Asset } from "expo-asset";
import type { PaperColorId } from "../../../src/lib/generation/paper-colors";
import type { DetailLevel } from "../../../src/lib/generation/detail-level";
import { NATIVE_PAPER_FIXTURES } from "../platform/assets";
import { NATIVE_PRODUCT_ID, type NativeApi, type NativeBilling, type NativeConfigResponse, type NativeGenerationResult, type NativeGoogleResponse } from "../contracts/native";
import type { NativeAuth } from "../services/native-auth";
import { NativeServiceError } from "../services/errors";
import { NativeReportService } from "../services/report";

type FixtureAuth = Pick<NativeAuth, "signIn" | "signOut" | "isAppleAvailable">;

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
  hasPurchased: boolean;
};

/**
 * Isolated presentation fixture. The caller must pass the runtime's explicit
 * package-and-flag gate. It never reports an enabled server, account, trial,
 * or purchase entitlement to production services.
 */
export function createFrontendFixtureServices(enabled = false, options: FrontendFixtureOptions = {}): FrontendFixtureServices {
  if (!enabled) throw new Error("Frontend fixture mode is explicitly disabled");

  const state: FixtureState = { signedIn: false, balance: 0, freeRemaining: 4, hasPurchased: false };
  const generationDelayMs = Math.max(0, options.generationDelayMs ?? 8_000);
  const config: NativeConfigResponse = {
    enabled: false,
    packageName: "nl.samistudio.doodle",
    minimumVersionCode: 2,
    attestation: "play_integrity",
    guestEnabled: false,
  };
  const signedOut = () => ({ authenticated: false, email: null, balance: 0, freeRemaining: state.freeRemaining, hasPurchased: state.hasPurchased });
  const signedIn = () => ({ authenticated: true, email: "preview@example.test", balance: state.balance, freeRemaining: state.freeRemaining, hasPurchased: state.hasPurchased });
  const googleResponse = (): NativeGoogleResponse => ({
    authenticated: true,
    email: "preview@example.test",
    accessToken: "fixture-access-token",
    expiresAt: Date.now() + 3_600_000,
  });

  const api: NativeApi = {
    async getConfig() { return config; },
    async signInWithApple() { throw new Error("Apple authorization is not simulated by this fixture"); },
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
      state.freeRemaining = 4;
      state.hasPurchased = false;
    },
    async createGuestSession() { throw new NativeServiceError("native_generation_unavailable"); },
    async generate(_scene: string, _detailLevel?: DetailLevel, _photo?: string, paperColor: PaperColorId = "yellow"): Promise<NativeGenerationResult> {
      // Keep the fixture delay long enough to inspect the waiting state on a device.
      if (generationDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, generationDelayMs));
      const resolved = Asset.fromModule(NATIVE_PAPER_FIXTURES[paperColor] as number);
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

  const catalog = getPlayCatalog(new Date("2026-10-10T12:00:00Z"));
  const pricedCatalog = { ...catalog, packs: catalog.packs.map(pack => {
    const price = pack.productId === "pack_mini" ? 1.99 : pack.productId === "pack_regular" ? 4.99 : 9.99;
    return { ...pack, price, priceMicros: Math.round(price * 1000000), currency: "EUR", priceLabel: "\u20ac" + price.toFixed(2) };
  }) };
  const billing: NativeBilling = {
    async preparePacks() { return pricedCatalog; },
    async buyPack(productId, expectedCredits) {
      const pack = pricedCatalog.packs.find(item => item.productId === productId);
      if (!pack || expectedCredits !== pack.credits) throw new NativeServiceError("offer_changed");
      state.balance += pack.credits;
      state.hasPurchased = true;
      return { status: "granted", balance: state.balance, productId, creditsGranted: pack.credits, offerApplied: pack.offerApplied };
    },
    async recoverPacks() {},
    async prepare() { return { productId: NATIVE_PRODUCT_ID, priceLabel: "€4.99" }; },
    async buy() { state.balance += 10; state.hasPurchased = true; },
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
