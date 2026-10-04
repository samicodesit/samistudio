import { useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { getLandingCopy } from "../../../src/lib/landing-copy";
import { NativeModalFrame, NATIVE_CLOSE_LABELS } from "./NativeModals";
import { NATIVE_COLORS, nativeFontFamily, nativeTextAlign } from "./theme";
import type { NativeDirection, NativeDoodleUiCopy, NativeLocale } from "./types";

const PAPERS = require("../../assets/pastel-examples.webp");

export function NativeArtExamples({ locale, direction, copy }: { locale: NativeLocale; direction: NativeDirection; copy: NativeDoodleUiCopy }) {
  const [open, setOpen] = useState(false);
  const { width } = useWindowDimensions();
  const landing = getLandingCopy(locale);
  const textStyle = { textAlign: nativeTextAlign(direction) };
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={[styles.title, textStyle, { fontFamily: nativeFontFamily(locale, "display") }]}>{landing.momentTitle}</Text>
    <Text style={[styles.body, textStyle, { fontFamily: nativeFontFamily(locale, "body") }]}>{landing.momentBody}</Text>
    <Pressable accessibilityRole="imagebutton" accessibilityLabel={`${landing.examples}. ${copy.stage.viewLarger}`} onPress={() => setOpen(true)}>
      <Image source={PAPERS} contentFit="contain" accessible={false} style={{ width: "100%", aspectRatio: 1400 / 527 }} />
    </Pressable>
    <NativeModalFrame visible={open} title={landing.examples} closeLabel={NATIVE_CLOSE_LABELS[locale]} locale={locale} direction={direction} onClose={() => setOpen(false)} contentKey="art-examples">
      <Image source={PAPERS} contentFit="contain" accessibilityLabel={landing.examples} style={{ width: "100%", height: (width - 64) * 527 / 1400 }} />
    </NativeModalFrame>
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: 10, paddingTop: 8 },
  title: { color: NATIVE_COLORS.graphite, fontSize: 22, fontWeight: "600", lineHeight: 28 },
  body: { color: NATIVE_COLORS.muted, fontSize: 14, lineHeight: 21, marginBottom: 8 },
});
