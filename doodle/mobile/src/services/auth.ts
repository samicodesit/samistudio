import type { NativeGoogleResponse } from "../contracts/native";
import { NativeServiceError } from "./errors";

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
}

export class GoogleAuthService {
  private configured = false;

  constructor(private readonly options: GoogleAuthServiceOptions) {}

  async signIn(): Promise<NativeGoogleResponse> {
    const webClientId = this.options.webClientId?.trim();
    if (!webClientId || !/^[^\s]+\.apps\.googleusercontent\.com$/.test(webClientId)) throw new NativeServiceError("auth_unavailable");
    if (!this.configured) {
      try {
        this.options.google.configure({ webClientId, offlineAccess: false });
        this.configured = true;
      } catch {
        throw new NativeServiceError("auth_unavailable");
      }
    }
    try {
      const playServicesReady = await this.options.google.hasPlayServices({ showPlayServicesUpdateDialog: true });
      if (!playServicesReady) throw new NativeServiceError("auth_unavailable");
      const result = await this.options.google.signIn();
      if (result.type === "cancelled") throw new NativeServiceError("auth_cancelled");
      if (!result.data.idToken) throw new NativeServiceError("auth_unavailable");
      return await this.options.signInWithGoogle(result.data.idToken);
    } catch (error) {
      if (error instanceof NativeServiceError) throw error;
      throw new NativeServiceError("auth_unavailable");
    }
  }

  async signOut(): Promise<void> {
    try {
      await this.options.google.signOut();
    } catch {
      // Local provider state is best-effort. The server session is revoked by the API adapter.
    }
  }
}
