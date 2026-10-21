import * as AppleAuthentication from "expo-apple-authentication";
import { GoogleSigninButton } from "@react-native-google-signin/google-signin";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { NATIVE_COLORS, nativeFontFamily, nativeTextAlign } from "./theme";
import type { NativeDoodleUiCopy, NativeLocale } from "./types";

interface Props {
  locale: NativeLocale;
  copy: NativeDoodleUiCopy;
  busy?: boolean;
  pendingProvider?: "google" | "apple";
  onGoogle(): void;
  onApple?(): void;
}

export function NativeSignInChoices({ locale, copy, busy = false, pendingProvider, onGoogle, onApple }: Props) {
  const loading = busy && !!pendingProvider;
  const font = { fontFamily: nativeFontFamily(locale, "body") };
  return <View style={styles.choices}>
    <GoogleSigninButton accessibilityRole="button" accessibilityLabel={copy.auth.google} accessibilityState={{ disabled: busy, busy: busy && pendingProvider === "google" }} disabled={busy} onPress={() => { if (!busy) onGoogle(); }} size={GoogleSigninButton.Size.Wide} color={GoogleSigninButton.Color.Light} style={styles.google} />
    {onApple ? <View pointerEvents={busy ? "none" : "auto"} style={busy ? styles.disabled : undefined}>
      <AppleAuthentication.AppleAuthenticationButton buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE} buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK} cornerRadius={12} style={styles.apple} accessibilityState={{ disabled: busy, busy: busy && pendingProvider === "apple" }} onPress={() => { if (!busy) onApple(); }} />
    </View> : null}
    {onApple ? <View style={styles.statusArea}>
      <Text accessibilityElementsHidden={loading} importantForAccessibility={loading ? "no-hide-descendants" : "auto"} style={[styles.hint, font, { textAlign: nativeTextAlign(locale === "ar" ? "rtl" : "ltr"), opacity: loading ? 0 : 1 }]}>{copy.auth.providerHint}</Text>
      {loading ? <View accessibilityLiveRegion="polite" style={styles.progress}>
        <ActivityIndicator color={NATIVE_COLORS.moss} accessibilityLabel={copy.auth.loading} />
        <Text style={[styles.hint, font]}>{copy.auth.loading}</Text>
      </View> : null}
    </View> : loading ? <View style={styles.standaloneProgress}><ActivityIndicator color={NATIVE_COLORS.moss} /><Text style={[styles.hint, font]}>{copy.auth.loading}</Text></View> : null}
  </View>;
}

const styles = StyleSheet.create({
  choices: { gap: 12 },
  hint: { color: NATIVE_COLORS.graphite, fontSize: 14, lineHeight: 20 },
  google: { width: "100%", height: 52 },
  apple: { width: "100%", height: 52 },
  statusArea: { position: "relative" },
  progress: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  standaloneProgress: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  disabled: { opacity: 0.65 },
});
