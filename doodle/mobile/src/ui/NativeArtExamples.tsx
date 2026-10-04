import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { getLandingCopy } from "../../../src/lib/landing-copy";
import { NATIVE_COLORS, nativeFontFamily, nativeTextAlign } from "./theme";
import type { NativeDirection, NativeDoodleUiCopy, NativeLocale } from "./types";

const PAPERS = require("../../assets/pastel-examples.webp");

export function NativeArtExamples({ locale, direction, copy, onOpenIdeas }: { locale: NativeLocale; direction: NativeDirection; copy: NativeDoodleUiCopy; onOpenIdeas(): void }) {
  const landing = getLandingCopy(locale);
  const textStyle = { textAlign: nativeTextAlign(direction) };
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={[styles.title, textStyle, { fontFamily: nativeFontFamily(locale, "display") }]}>{landing.momentTitle}</Text>
    <Text style={[styles.body, textStyle, { fontFamily: nativeFontFamily(locale, "body") }]}>{landing.momentBody}</Text>
    <Pressable accessibilityRole="imagebutton" accessibilityLabel={`${landing.showcaseAlt}. ${copy.navigation.ideas}`} onPress={onOpenIdeas}>
      <Image source={PAPERS} cachePolicy="memory" contentFit="contain" accessible={false} style={{ width: "100%", aspectRatio: 1400 / 527 }} />
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: 10, paddingTop: 8 },
  title: { color: NATIVE_COLORS.graphite, fontSize: 22, fontWeight: "600", lineHeight: 28 },
  body: { color: NATIVE_COLORS.muted, fontSize: 14, lineHeight: 21, marginBottom: 8 },
});
