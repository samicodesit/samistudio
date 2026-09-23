import { GoogleSignin } from "@react-native-google-signin/google-signin";
import type { GoogleSignInApi } from "../services/auth";

export const googleSignInModule: GoogleSignInApi = {
  configure: (options) => GoogleSignin.configure(options as Parameters<typeof GoogleSignin.configure>[0]),
  hasPlayServices: (options) => GoogleSignin.hasPlayServices(options),
  signIn: () => GoogleSignin.signIn(),
  signOut: () => GoogleSignin.signOut(),
};
