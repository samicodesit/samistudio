import * as AppleAuthentication from "expo-apple-authentication";
import type { AppleSignInApi } from "../services/apple-auth";

export const appleSignInModule: AppleSignInApi = {
  isAvailable: () => AppleAuthentication.isAvailableAsync(),
  signIn: nonceHash => AppleAuthentication.signInAsync({
    requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
    nonce: nonceHash,
  }),
};
