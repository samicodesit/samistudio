import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { NativeIcon } from "./NativeIcon";
import { NativeImageModal } from "./NativeModals";
import { NATIVE_COLORS, NATIVE_SPACING, nativeFontFamily, nativeRowDirection, nativeTextAlign } from "./theme";
import type { NativeDirection, NativeDoodleUiCopy, NativeIdea, NativeLocale } from "./types";

interface NativeIdeasViewProps {
  locale: NativeLocale;
  direction: NativeDirection;
  copy: NativeDoodleUiCopy;
  ideas: readonly NativeIdea[];
  isGenerating: boolean;
  onSelectIdea(id: string): void;
  reducedMotion: boolean;
}

export function NativeIdeasView({ locale, direction, copy, ideas, isGenerating, onSelectIdea, reducedMotion }: NativeIdeasViewProps) {
  const [preview, setPreview] = useState<NativeIdea | null>(null);
  const { width } = useWindowDimensions();
  const compact = width < 520;
  const narrow = width < 360;
  return (
    <>
    <ScrollView contentContainerStyle={[styles.content, narrow && styles.narrowContent]} showsVerticalScrollIndicator={false}>
      <Text accessibilityRole="header" style={[styles.title, narrow && styles.narrowTitle, { fontFamily: nativeFontFamily(locale, "display"), textAlign: nativeTextAlign(direction) }]}> 
        {copy.ideas.title}
      </Text>
      <Text style={[styles.hint, narrow && styles.narrowHint, { fontFamily: nativeFontFamily(locale, "body"), textAlign: nativeTextAlign(direction) }]}> 
        {copy.ideas.hint}
      </Text>
      <View style={[styles.grid, compact && styles.compactGrid, { flexDirection: compact ? "column" : nativeRowDirection(direction) }]}>
        {ideas.map((idea) => (
          <View
            key={idea.id}
            style={[styles.card, compact && styles.compactCard, compact && { flexDirection: nativeRowDirection(direction) }, isGenerating && styles.disabledCard]}
          >
            <Pressable accessibilityRole="imagebutton" accessibilityLabel={`${copy.stage.viewLarger}: ${idea.prompt}`} onPress={() => setPreview(idea)} style={({ pressed }) => [compact ? styles.compactImage : styles.image, pressed && styles.pressed]}>
            <Image source={idea.imageUri} cachePolicy={typeof idea.imageUri === "number" ? "memory" : "disk"} contentFit="cover" style={[styles.image, compact && styles.compactImage]} accessibilityLabel="" />
            <View pointerEvents="none" style={[styles.expandCue, direction === "rtl" ? { left: 8 } : { right: 8 }]}><NativeIcon name="expand" size={16} color={NATIVE_COLORS.paper} /></View>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`${idea.actionLabel}: ${idea.prompt}`} accessibilityState={{ disabled: isGenerating }} disabled={isGenerating} onPress={() => onSelectIdea(idea.id)} style={({ pressed }) => [styles.cardBody, pressed && !isGenerating && styles.pressed]}>
              <Text style={[styles.prompt, compact && styles.compactPrompt, { fontFamily: nativeFontFamily(locale, "body"), textAlign: nativeTextAlign(direction) }]}>{idea.prompt}</Text>
              <View style={[styles.action, compact && styles.compactAction, { flexDirection: nativeRowDirection(direction) }]}>
                <Text style={[styles.actionText, { fontFamily: nativeFontFamily(locale, "body") }]}>{idea.actionLabel}</Text>
                <NativeIcon name="chevronForward" size={17} color={NATIVE_COLORS.moss} />
              </View>
            </Pressable>
          </View>
        ))}
      </View>
    </ScrollView>
    {preview ? <NativeImageModal key={preview.id} visible locale={locale} direction={direction} copy={copy} imageUri={preview.previewImageUri ?? preview.imageUri} imageAlt={preview.prompt} onClose={() => setPreview(null)} actionLabel={preview.actionLabel} actionIcon="create" onAction={() => { setPreview(null); onSelectIdea(preview.id); }} reducedMotion={reducedMotion} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  content: { gap: 10, paddingBottom: 24, paddingHorizontal: NATIVE_SPACING.screen, paddingTop: 18 },
  narrowContent: { gap: 8 },
  title: { color: NATIVE_COLORS.graphite, fontSize: 32, fontWeight: "600", lineHeight: 36 },
  narrowTitle: { fontSize: 28, lineHeight: 32 },
  hint: { color: NATIVE_COLORS.muted, fontSize: 16, lineHeight: 22, marginBottom: 10 },
  narrowHint: { fontSize: 15, lineHeight: 20, marginBottom: 8 },
  grid: { flexWrap: "wrap", gap: 12, justifyContent: "space-between" },
  compactGrid: { flexWrap: "nowrap" },
  card: { backgroundColor: NATIVE_COLORS.paper, borderColor: NATIVE_COLORS.softLine, borderRadius: 14, borderWidth: 1, marginBottom: 2, overflow: "hidden", paddingBottom: 12, width: "48.1%" },
  compactCard: { minHeight: 112, paddingBottom: 0, width: "100%" },
  disabledCard: { opacity: 0.55 },
  image: { aspectRatio: 1, backgroundColor: NATIVE_COLORS.sticky, width: "100%" },
  compactImage: { alignSelf: "center", aspectRatio: 1, height: 112, width: 112 },
  expandCue: { position: "absolute", bottom: 8, width: 28, height: 28, borderRadius: 9, backgroundColor: NATIVE_COLORS.graphite, alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1, justifyContent: "space-between", minWidth: 0 },
  prompt: { color: NATIVE_COLORS.graphite, fontSize: 14, lineHeight: 19, minHeight: 56, paddingHorizontal: 11, paddingTop: 10 },
  compactPrompt: { minHeight: 0, paddingBottom: 4, paddingHorizontal: 12, paddingTop: 11 },
  action: { alignItems: "center", gap: 4, justifyContent: "space-between", paddingHorizontal: 11, paddingTop: 8 },
  compactAction: { paddingBottom: 11, paddingHorizontal: 12, paddingTop: 4 },
  actionText: { color: NATIVE_COLORS.moss, flex: 1, flexShrink: 1, fontSize: 13, fontWeight: "700", minWidth: 0 },
  pressed: { opacity: 0.72 },
});
