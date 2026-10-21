import type { NativeAppleCredentials, NativeAppleResponse } from "../contracts/native";
import { NativeServiceError } from "./errors";

export interface AppleSignInApi {
  isAvailable(): Promise<boolean>;
  signIn(nonceHash: string): Promise<{ identityToken: string | null; authorizationCode: string | null }>;
}
export interface AppleAuthOptions {
  apple: AppleSignInApi;
  randomNonce(): Promise<string>;
  sha256(value: string): Promise<string>;
  exchange(input: NativeAppleCredentials): Promise<NativeAppleResponse>;
}
export class AppleAuthService {
  constructor(private readonly options: AppleAuthOptions) {}
  isAvailable(): Promise<boolean> { return this.options.apple.isAvailable(); }
  async signIn(): Promise<NativeAppleResponse> {
    let credential: { identityToken: string | null; authorizationCode: string | null };
    let nonce: string;
    try {
      if (!(await this.isAvailable())) throw new NativeServiceError("auth_unavailable");
      nonce = await this.options.randomNonce();
      if (!/^[a-f0-9]{64}$/.test(nonce)) throw new NativeServiceError("auth_unavailable");
      const nonceHash = await this.options.sha256(nonce);
      credential = await this.options.apple.signIn(nonceHash);
    } catch (error) {
      if (error instanceof NativeServiceError) throw error;
      const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
      throw new NativeServiceError(code === "ERR_REQUEST_CANCELED" ? "auth_cancelled" : "auth_unavailable");
    }
    if (!credential.identityToken || !credential.authorizationCode) throw new NativeServiceError("auth_unavailable");
    return this.options.exchange({ identityToken: credential.identityToken, authorizationCode: credential.authorizationCode, nonce });
  }
}
