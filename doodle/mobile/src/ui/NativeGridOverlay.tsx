import { useEffect, useMemo, useRef, useState } from "react";
import LottieView from "lottie-react-native";
import { Animated, StyleSheet } from "react-native";
import { GRID_FADE_MS } from "@web/lib/grid-copy";
import { gridComposition } from "./grid-composition";

export function NativeGridOverlay({ enabled, reducedMotion = false }: { enabled: boolean; reducedMotion?: boolean }) {
  const opacity = useRef(new Animated.Value(enabled ? 1 : 0)).current;
  const [size, setSize] = useState({ width: 0, height: 0 });
  const source = useMemo(() => size.width > 0 && size.height > 0 ? gridComposition(size.width, size.height) : null, [size]);
  useEffect(() => {
    const animation = Animated.timing(opacity, { toValue: enabled ? 1 : 0, duration: reducedMotion ? 0 : GRID_FADE_MS, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [enabled, opacity, reducedMotion]);
  return <Animated.View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { opacity }]} onLayout={({ nativeEvent: { layout } }) => setSize(current => current.width === layout.width && current.height === layout.height ? current : { width: layout.width, height: layout.height })}>
    {source ? <LottieView source={source} progress={0} autoPlay={false} loop={false} style={StyleSheet.absoluteFill} /> : null}
  </Animated.View>;
}
