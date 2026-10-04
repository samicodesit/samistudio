import { Image } from "expo-image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Keyboard, PanResponder, Pressable, StyleSheet, View } from "react-native";
import { DETAIL_LEVELS, type DetailLevel } from "../../../src/lib/generation/detail-level";
import { detailDockSwipe } from "../../../src/lib/detail-dock";
import { getDetailLevelCopy } from "../../../src/lib/detail-level-copy";
import { NATIVE_COLORS, nativeRowDirection } from "./theme";
import { NativeIcon } from "./NativeIcon";
import type { NativeDirection, NativeLocale } from "./types";

const FLOWERS: Record<DetailLevel, number> = {
  simple: require("../../assets/detail/simple.png"),
  medium: require("../../assets/detail/medium.png"),
  detailed: require("../../assets/detail/detailed.png"),
};

export function NativeDetailSelector({ locale, direction, value, disabled, reducedMotion, onChange, onFocusVisible }: {
  locale: NativeLocale; direction: NativeDirection; value: DetailLevel;
  disabled: boolean; reducedMotion: boolean; onChange(level: DetailLevel): void; onFocusVisible(tile: View): void;
}) {
  const copy = getDetailLevelCopy(locale);
  const [expanded, setExpanded] = useState(true);
  const [focused, setFocused] = useState<DetailLevel | "toggle" | null>(null);
  const progress = useRef(new Animated.Value(1)).current;
  const tiles = useRef<Array<View | null>>([]);
  const toggle = useRef<View | null>(null);
  useEffect(() => {
    if (reducedMotion) {
      progress.stopAnimation();
      progress.setValue(expanded ? 1 : 0);
      return;
    }
    const animation = Animated.timing(progress, { toValue: expanded ? 1 : 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [expanded, progress, reducedMotion]);
  const gestures = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: () => !disabled,
    onPanResponderRelease: (_event, gesture) => {
      const next = detailDockSwipe(gesture.dx, gesture.dy);
      if (disabled) return;
      Keyboard.dismiss();
      setFocused(null);
      if (next !== null) setExpanded(next);
      else if (Math.abs(gesture.dx) < 6 && Math.abs(gesture.dy) < 6) setExpanded(current => !current);
    },
  }), [disabled]);
  return <View style={styles.group}>
    <Animated.View importantForAccessibility={expanded ? "auto" : "no-hide-descendants"} accessibilityElementsHidden={!expanded}
      pointerEvents={expanded ? "auto" : "none"} style={[styles.drawer, direction === "rtl" ? { left: 4 } : { right: 4 }, {
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [56, 0] }) }],
      }]}>
      <View accessibilityRole={expanded ? "radiogroup" : undefined} accessibilityLabel={expanded ? copy.label : undefined} style={[styles.tiles, { flexDirection: nativeRowDirection(direction) }]}>
        {DETAIL_LEVELS.map((level, index) => <Pressable key={level} ref={tile => { tiles.current[index] = tile; }} accessible={expanded} focusable={expanded && !disabled} importantForAccessibility={expanded ? "yes" : "no-hide-descendants"} accessibilityRole={expanded ? "radio" : undefined}
          accessibilityLabel={expanded ? copy.levels[level] : undefined} accessibilityState={{ checked: value === level, disabled: disabled || !expanded }}
          disabled={disabled || !expanded} onPressIn={() => Keyboard.dismiss()} onPress={() => onChange(level)}
          onFocus={() => { setFocused(level); const tile = tiles.current[index]; if (tile) onFocusVisible(tile); }} onBlur={() => setFocused(null)}
          style={({ pressed }) => [styles.tile, index > 0 && (direction === "rtl" ? styles.dividedRtl : styles.divided), focused === level && styles.focused, disabled && styles.disabled, pressed && !disabled && styles.pressed]}>
          <Image source={FLOWERS[level]} accessible={false} contentFit="contain" style={[styles.flower, index === 0 && (direction === "rtl" ? styles.roundRight : styles.roundLeft), index === 2 && (direction === "rtl" ? styles.roundLeft : styles.roundRight)]} />
          {value === level ? <View pointerEvents="none" style={[styles.check, direction === "rtl" ? { left: 3 } : { right: 3 }]}><NativeIcon name="check" size={10} color={NATIVE_COLORS.paper} /></View> : null}
        </Pressable>)}
      </View>
    </Animated.View>
    <Animated.View {...gestures.panHandlers} style={[styles.toggleWrap, direction === "rtl" ? { left: 65 } : { right: 65 }, { transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [56, 0] }) }] }]}>
      <Pressable ref={toggle} accessibilityRole="button" accessibilityLabel={(expanded ? copy.hide : copy.show) + " (" + copy.levels[value] + ")"}
        accessibilityState={{ expanded, disabled }} disabled={disabled}
        onPressIn={() => Keyboard.dismiss()} onPress={() => { setFocused(null); setExpanded(!expanded); }}
        onFocus={() => { setFocused("toggle"); if (toggle.current) onFocusVisible(toggle.current); }} onBlur={() => setFocused(null)}
        style={({ pressed }) => [styles.toggle, focused === "toggle" && styles.focused, pressed && styles.pressed, disabled && styles.disabled]}>
        <View pointerEvents="none" style={styles.handle}><NativeIcon name={expanded ? "chevronDown" : "chevronUp"} size={16} color={NATIVE_COLORS.graphite} /></View>
      </Pressable>
    </Animated.View>
  </View>;
}
const styles = StyleSheet.create({
  group: { overflow: "visible", width: 174, height: 104, flexShrink: 0 },
  drawer: { position: "absolute", top: 48, width: 170, height: 70, borderWidth: 1, borderColor: NATIVE_COLORS.line, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: NATIVE_COLORS.sticky },
  tiles: {},
  tile: { width: 56, height: 56 },
  divided: { borderLeftWidth: 1, borderLeftColor: "rgba(32, 35, 31, 0.2)" },
  dividedRtl: { borderRightWidth: 1, borderRightColor: "rgba(32, 35, 31, 0.2)" },
  focused: { outlineColor: NATIVE_COLORS.moss, outlineWidth: 2, outlineOffset: -3 },
  flower: { width: "100%", height: "100%" },
  roundLeft: { borderTopLeftRadius: 5 },
  roundRight: { borderTopRightRadius: 5 },
  check: { position: "absolute", top: 3, width: 13, height: 13, borderRadius: 7, backgroundColor: NATIVE_COLORS.moss, alignItems: "center", justifyContent: "center" },
  toggleWrap: { position: "absolute", top: 0, zIndex: 1 },
  toggle: { width: 48, height: 48, alignItems: "center", justifyContent: "flex-end" },
  handle: { bottom: -1, width: 40, height: 24, alignItems: "center", justifyContent: "center", backgroundColor: NATIVE_COLORS.sticky, borderWidth: 1, borderBottomWidth: 0, borderColor: NATIVE_COLORS.line, borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  disabled: { opacity: 0.65 },
  pressed: { opacity: 0.85 },
});
