import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { GRID_COPY } from "@web/lib/grid-copy";
import { NativeGridOverlay } from "./NativeGridOverlay";
import { NATIVE_COLORS } from "./theme";
import type { NativeDirection, NativeLocale } from "./types";

interface NativeDoodleGridFrameProps {
  children: ReactNode;
  locale: NativeLocale;
  direction: NativeDirection;
  reducedMotion: boolean;
  enabled?: boolean;
  onToggle?(): void;
  style?: StyleProp<ViewStyle>;
}

export function NativeDoodleGridFrame({ children, locale, direction, reducedMotion, enabled, onToggle, style }: NativeDoodleGridFrameProps) {
  const [localEnabled, setLocalEnabled] = useState(false);
  const active = enabled ?? localEnabled;
  return (
    <View style={style}>
      {children}
      <NativeGridOverlay enabled={active} reducedMotion={reducedMotion} />
      <Pressable accessibilityRole="button" accessibilityLabel={GRID_COPY[locale][active ? "hide" : "show"]} accessibilityState={{ selected: active }} onPress={onToggle ?? (() => setLocalEnabled(value => !value))} style={({ pressed }) => [styles.toggle, { [direction === "rtl" ? "right" : "left"]: 14 }, active && styles.active, pressed && styles.pressed]}>
        <View style={styles.glyph}><View style={styles.vertical} /><View style={styles.horizontal} /></View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: { position: "absolute", bottom: 14, width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(32,35,31,0.8)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(252,252,248,0.32)" },
  active: { backgroundColor: NATIVE_COLORS.moss, borderColor: NATIVE_COLORS.paper },
  pressed: { opacity: 0.72 },
  glyph: { width: 18, height: 18, borderWidth: 1.5, borderColor: NATIVE_COLORS.paper, borderRadius: 2 },
  vertical: { position: "absolute", left: "50%", top: 0, bottom: 0, width: 1.5, backgroundColor: NATIVE_COLORS.paper },
  horizontal: { position: "absolute", top: "50%", left: 0, right: 0, height: 1.5, backgroundColor: NATIVE_COLORS.paper },
});
