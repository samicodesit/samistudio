import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { NativeIcon } from "./NativeIcon";
import { NATIVE_COLORS, nativeFontFamily } from "./theme";
import type { NativeAccountUi, NativeDoodleUiCopy, NativeLocale } from "./types";

interface NativeAccountSlotProps {
  locale: NativeLocale;
  copy: NativeDoodleUiCopy;
  account: NativeAccountUi;
  onPress(): void;
}

export function NativeAccountSlot({ locale, copy, account, onPress }: NativeAccountSlotProps) {
  const loading = account.status === "loading";
  const signedIn = account.status === "signedIn";
  const retryable = account.status === "error";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={copy.account.label}
      accessibilityState={{ busy: loading }}
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [styles.slot, signedIn ? styles.avatarSlot : styles.signInSlot, pressed && styles.pressed]}
    >
      {loading ? <ActivityIndicator color={NATIVE_COLORS.moss} /> : null}
      {!loading && signedIn ? (
        <View style={styles.avatar}>
          <Text style={[styles.avatarText, { fontFamily: nativeFontFamily(locale, "body") }]}>{account.initial || "?"}</Text>
        </View>
      ) : null}
      {!loading && !signedIn ? <NativeIcon name="signIn" size={18} color={NATIVE_COLORS.moss} /> : null}
      {!loading && !signedIn ? <Text style={[styles.signInText, { fontFamily: nativeFontFamily(locale, "body") }]}>{retryable ? copy.actions.tryAgain : copy.auth.signIn}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slot: { alignItems: "center", justifyContent: "center", minHeight: 48 },
  avatarSlot: { minWidth: 48 },
  signInSlot: { borderColor: NATIVE_COLORS.moss, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 7, minWidth: 92, paddingHorizontal: 14 },
  avatar: { alignItems: "center", backgroundColor: NATIVE_COLORS.selected, borderColor: NATIVE_COLORS.moss, borderRadius: 999, borderWidth: 1, height: 42, justifyContent: "center", width: 42 },
  avatarText: { color: NATIVE_COLORS.moss, fontSize: 18, fontWeight: "700" },
  signInText: { color: NATIVE_COLORS.moss, fontSize: 14, fontWeight: "600" },
  pressed: { opacity: 0.72 },
});
