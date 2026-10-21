import type { NativeAuthProvider, NativeAuthResponse } from "../contracts/native";
import type { AppleAuthService } from "./apple-auth";
import type { GoogleAuthService } from "./auth";
import { NativeServiceError } from "./errors";

export interface NativeAuth {
  signIn(provider?: NativeAuthProvider): Promise<NativeAuthResponse>;
  signOut(): Promise<void>;
  isAppleAvailable?(): Promise<boolean>;
}

export class NativeAuthService implements NativeAuth {
  private pending = false;
  constructor(private readonly google: Pick<GoogleAuthService, "signIn" | "signOut">, private readonly apple?: Pick<AppleAuthService, "signIn" | "isAvailable">) {}
  async signIn(provider: NativeAuthProvider = "google"): Promise<NativeAuthResponse> {
    if (this.pending || (provider !== "google" && provider !== "apple") || (provider === "apple" && !this.apple)) throw new NativeServiceError("auth_unavailable");
    this.pending = true;
    try { return provider === "apple" ? await this.apple!.signIn() : await this.google.signIn(); }
    finally { this.pending = false; }
  }
  signOut(): Promise<void> { return this.google.signOut(); }
  async isAppleAvailable(): Promise<boolean> { return this.apple ? this.apple.isAvailable().catch(() => false) : false; }
}
