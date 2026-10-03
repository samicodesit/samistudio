import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { GRID_FADE_MS, GRID_LINE_COLOR, GRID_POSITIONS } from "@web/lib/grid-copy";

export function NativeGridOverlay({ enabled, reducedMotion = false }: { enabled: boolean; reducedMotion?: boolean }) {
  const opacity = useRef(new Animated.Value(enabled ? 1 : 0)).current;
  useEffect(() => {
    const animation = Animated.timing(opacity, { toValue: enabled ? 1 : 0, duration: reducedMotion ? 0 : GRID_FADE_MS, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [enabled, opacity, reducedMotion]);
  return <Animated.View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { opacity }]}>
    {GRID_POSITIONS.map(position => <View key={position} style={StyleSheet.absoluteFill}>
      <View style={[styles.vertical, { left: `${position}%` }]} />
      <View style={[styles.horizontal, { top: `${position}%` }]} />
    </View>)}
  </Animated.View>;
}

const styles = StyleSheet.create({
  vertical: { position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: GRID_LINE_COLOR },
  horizontal: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: GRID_LINE_COLOR },
});
