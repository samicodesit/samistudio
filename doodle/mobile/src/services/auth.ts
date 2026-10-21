import type { NativeGoogleResponse } from "../contracts/native";
import { NativeServiceError } from "./errors";
import type { NativeDiagnosticsSink } from "./diagnostics";

export interface GoogleSignInApi {
  configure(options: { webClientId: string; offlineAccess: boolean }): void;
  hasPlayServices(options: { showPlayServicesUpdateDialog: boolean }): Promise<boolean>;
  signIn(): Promise<{ type: "success"; data: { idToken: string | null } } | { type: "cancelled"; data: null }>;
  signOut(): Promise<unknown>;
}

export interface GoogleAuthServiceOptions {
  google: GoogleSignInApi;
  webClientId: string | null | undefined;
  signInWithGoogle(credential: string): Promise<NativeGoogleResponse>;
  diagnostics?: NativeDiagnosticsSink;
}

export class GoogleAuthService {
  private configured = false;

  constructor(private readonly options: GoogleAuthServiceOptions) {}

  async signIn(): Promise<NativeGoogleResponse> {
    const startedAt = Date.now();
    const webClientId = this.options.webClientId?.trim();
    if (!webClientId || !/^[^\s]+\.apps\.googleusercontent\.com$/.test(webClientId)) {
      this.record("google_configure", "auth_unavailable", startedAt);
      throw new NativeServiceError("auth_unavailable");
    }
    if (!this.configured) {
      try {
        this.options.google.configure({ webClientId, offlineAccess: false });
        this.configured = true;
      } catch (error) {
        this.record("google_configure", "auth_unavailable", startedAt, providerCode(error));
        throw new NativeServiceError("auth_unavailable");
      }
    }
    let playServicesReady: boolean;
    try {
      playServicesReady = await this.options.google.hasPlayServices({ showPlayServicesUpdateDialog: true });
    } catch (error) {
      this.record("google_services", "auth_unavailable", startedAt, providerCode(error));
      throw new NativeServiceError("auth_unavailable");
    }
    if (!playServicesReady) {
      this.record("google_services", "auth_unavailable", startedAt);
      throw new NativeServiceError("auth_unavailable");
    }
    let idToken: string;
    try {
      const result = await this.options.google.signIn();
      if (result.type === "cancelled") {
        throw new NativeServiceError("auth_cancelled");
      }
      if (!result.data.idToken) {
        this.record("google_sign_in", "auth_unavailable", startedAt);
        throw new NativeServiceError("auth_unavailable");
      }
      idToken = result.data.idToken;
    } catch (error) {
      if (error instanceof NativeServiceError) throw error;
      this.record("google_sign_in", "auth_unavailable", startedAt, providerCode(error));
      throw new NativeServiceError("auth_unavailable");
    }
    try {
      return await this.options.signInWithGoogle(idToken);
    } catch (error) {
      if (error instanceof NativeServiceError) throw error;
      throw new NativeServiceError("auth_unavailable");
    }
  }

  async signOut(): Promise<void> {
    try {
      await this.options.google.signOut();
    } catch (error) {
      this.record("google_sign_in", "auth_unavailable", Date.now(), providerCode(error));
      // Local provider state is best-effort. The server session is revoked by the API adapter.
    }
  }

  private record(stage: "google_configure" | "google_services" | "google_sign_in" | "google_token", code: unknown, startedAt: number, providerCodeValue?: unknown): void {
    const input = {
      operation: "auth" as const,
      stage,
      code,
      durationMs: boundedDuration(Date.now() - startedAt),
      ...(providerCodeValue === undefined ? {} : { providerCode: providerCodeValue }),
    };
    try {
      void Promise.resolve(this.options.diagnostics?.record(input)).catch(() => undefined);
    } catch {
      // Diagnostics must never change the authentication result.
    }
  }
}

function providerCode(error: unknown): unknown {
  if (!error || typeof error !== "object") return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" || typeof code === "number" ? code : undefined;
}

function boundedDuration(value: number): number {
  return Number.isSafeInteger(value) && value >= 0 ? Math.min(value, 190_000) : 0;
}
