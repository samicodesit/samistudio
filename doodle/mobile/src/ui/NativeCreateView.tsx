import type { DetailLevel } from "../../../src/lib/generation/detail-level";
import { getComposerIntro } from "../../../src/lib/composer-intro";
import { NativeDetailSelector } from "./NativeDetailSelector";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useMemo, useRef, useState } from "react";
import LottieView from "lottie-react-native";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { NativeIcon } from "./NativeIcon";
import { NativeDoodleGridFrame } from "./NativeDoodleGridFrame";
import { canSubmitScene, loadingMessageAt, shouldShowCharacterCount } from "./ui-logic";
import { NATIVE_COLORS, NATIVE_SPACING, nativeFontFamily, nativeRowDirection, nativeTextAlign } from "./theme";
import type {
  NativeDirection,
  NativeDoodleUiCopy,
  NativeDraftUi,
  NativeGenerationUiState,
  NativeImageSource,
  NativeLocale,
} from "./types";

interface NativeCreateViewProps {
  detailLevel: DetailLevel;
  detailReady: boolean;
  onDetailLevelChange(level: DetailLevel): void;
  locale: NativeLocale;
  direction: NativeDirection;
  copy: NativeDoodleUiCopy;
  draft: NativeDraftUi;
  generation: NativeGenerationUiState;
  usage: { status: "loading" | "ready"; label: string };
  referenceImageUri: NativeImageSource;
  reducedMotion: boolean;
  onSceneChange(scene: string): void;
  onCreate(): void;
  onRetry(): void;
  onSelectSuggestion(scene: string): void;
  onRefreshSuggestions(): void;
  onDownload(): void;
  onShare(): void;
  onNewScene(): void;
  onResultBack(): void;
  onOpenMore(): void;
  onOpenLarger(): void;
  gridEnabled?: boolean;
  onToggleGrid?(): void;
}

const PEN_DRAW_ANIMATION = require("../../assets/pen-draw.json");

export function NativeCreateView(props: NativeCreateViewProps) {
  const { generation } = props;
  const scrollView = useRef<ScrollView | null>(null);
  const insets = useSafeAreaInsets();
  const showFocusedDetail = (tile: View) => {
    if (!Keyboard.isVisible()) return;
    scrollView.current?.getNativeScrollRef()?.measureInWindow((_x, scrollTop) => {
      // Include system insets so Android's IME cannot cover the focus ring.
      scrollView.current?.scrollResponderScrollNativeHandleToKeyboard(tile, scrollTop + insets.top + insets.bottom + 8, true);
    });
  };
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        ref={scrollView}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scrollContent, generation.status === "waiting" && styles.waitingScrollContent]}
        showsVerticalScrollIndicator={false}
      >
        {generation.status === "waiting" ? <NativeWaitingCard {...props} state={generation} /> : null}
        {generation.status === "ready" ? <NativeResultCard key={generation.imageUri} {...props} state={generation} /> : null}
        {generation.status === "idle" || generation.status === "error" ? (
          <NativeComposer {...props} onDetailFocus={showFocusedDetail} error={generation.status === "error" ? generation.message : undefined} />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function NativeComposer({
  detailLevel,
  detailReady,
  onDetailLevelChange,
  onDetailFocus,
  locale,
  direction,
  copy,
  draft,
  error,
  onSceneChange,
  onCreate,
  onRetry,
  onSelectSuggestion,
  onRefreshSuggestions,
  reducedMotion,
  usage,
}: NativeCreateViewProps & { error?: string; onDetailFocus(tile: View): void }) {
  const [focused, setFocused] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const refreshInFlight = useRef(false);
  const refreshSpin = useRef(new Animated.Value(0)).current;
  const suggestionOpacity = useRef(new Animated.Value(1)).current;
  const suggestionOffset = useRef(new Animated.Value(0)).current;
  useEffect(() => () => {
    refreshSpin.stopAnimation();
    suggestionOpacity.stopAnimation();
    suggestionOffset.stopAnimation();
  }, [refreshSpin, suggestionOpacity, suggestionOffset]);

  const refreshIdeas = () => {
    if (refreshInFlight.current) return;
    if (reducedMotion) {
      onRefreshSuggestions();
      return;
    }
    refreshInFlight.current = true;
    setRefreshing(true);
    refreshSpin.setValue(0);
    suggestionOpacity.setValue(0);
    suggestionOffset.setValue(4);
    onRefreshSuggestions();
    Animated.parallel([
      Animated.timing(refreshSpin, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(suggestionOpacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(suggestionOffset, { toValue: 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (!finished) return;
      refreshInFlight.current = false;
      setRefreshing(false);
    });
  };
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 360;
  const intro = getComposerIntro(locale);
  const stackedHeading = fontScale > 1.3;
  const disabled = !detailReady || !canSubmitScene(draft.scene, draft.maxLength);
  return (
    <View style={[styles.composerScreen, compact && styles.compactComposerScreen]}>
      {error ? (
        <View accessible accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.errorBanner}>
          <NativeIcon name="report" size={19} color={NATIVE_COLORS.coral} />
          <Text style={[styles.errorText, { fontFamily: nativeFontFamily(locale, "body"), textAlign: nativeTextAlign(direction) }]}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.actions.tryAgain}
            onPress={onRetry}
            style={({ pressed }) => [styles.errorRetry, pressed && styles.pressed]}
          >
            <Text style={[styles.errorRetryText, { fontFamily: nativeFontFamily(locale, "body") }]}>{copy.actions.tryAgain}</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={[styles.composerBlock, compact && styles.compactComposerBlock]}>
        {stackedHeading ? <Text accessibilityRole="header" style={[styles.composerTitle, { fontFamily: nativeFontFamily(locale, "display"), textAlign: nativeTextAlign(direction) }]}>{intro.title}</Text> : null}
        <View style={styles.inputStack}>
          <View style={[styles.detailRow, { flexDirection: nativeRowDirection(direction) }]}>
            <View style={styles.sceneHeading}>
              {stackedHeading ? null : <Text accessibilityRole="header" style={[styles.composerTitle, { fontFamily: nativeFontFamily(locale, "display"), textAlign: nativeTextAlign(direction) }]}>{intro.title}</Text>}
              <Text style={[styles.composerHint, { fontFamily: nativeFontFamily(locale, "body"), textAlign: nativeTextAlign(direction) }]}>{intro.hint}</Text>
            </View>
            <NativeDetailSelector locale={locale} direction={direction} value={detailLevel} reducedMotion={reducedMotion} disabled={!detailReady} onChange={onDetailLevelChange} onFocusVisible={onDetailFocus} />
          </View>
          <View style={[styles.scenePaper, focused && styles.sceneInputFocused]}>
          <TextInput
            accessibilityLabel={copy.composer.label}
            accessibilityHint={copy.composer.hint}
            autoCapitalize="sentences"
            multiline
            maxLength={draft.maxLength}
            onChangeText={onSceneChange}
            onBlur={() => setFocused(false)}
            onFocus={() => setFocused(true)}
            placeholder={copy.composer.placeholder}
            placeholderTextColor={NATIVE_COLORS.muted}
            selectionColor={NATIVE_COLORS.moss}
            style={[styles.sceneInput, compact && styles.compactSceneInput, { fontFamily: nativeFontFamily(locale, "body"), textAlign: nativeTextAlign(direction) }]}
            value={draft.scene}
          />
        <View style={[styles.composerFooter, { flexDirection: stackedHeading ? "column" : nativeRowDirection(direction) }, stackedHeading && styles.composerFooterStacked]}>
          <View style={[styles.characterCountSlot, stackedHeading && styles.characterCountSlotStacked]}>
            <Text accessibilityLiveRegion="polite" style={[styles.composerUsage, { fontFamily: nativeFontFamily(locale, "body"), textAlign: nativeTextAlign(direction) }]}>{usage.status === "ready" ? usage.label : ""}</Text>
            {shouldShowCharacterCount(draft.usedLength) ? (
              <Text style={[styles.characterCount, { fontFamily: nativeFontFamily(locale, "body"), textAlign: nativeTextAlign(direction) }]}>
                {draft.characterCountLabel}
              </Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.composer.create}
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={onCreate}
            style={({ pressed }) => [styles.createButton, stackedHeading && styles.createButtonStacked, disabled && styles.disabledButton, pressed && !disabled && styles.pressed]}
          >
            <Text style={[styles.createButtonText, { fontFamily: nativeFontFamily(locale, "body") }]}>{copy.composer.create}</Text>
          </Pressable>
        </View>
          </View>
        </View>
      </View>

      <View style={styles.suggestionsBlock}>
        <View style={[styles.suggestionsHeading, { flexDirection: nativeRowDirection(direction) }]}>
          <Text accessibilityRole="header" style={[styles.suggestionsTitle, compact && styles.compactSuggestionsTitle, locale === "ar" && styles.arabicSuggestionsTitle, { fontFamily: nativeFontFamily(locale, "display"), textAlign: nativeTextAlign(direction) }]}>
            {copy.suggestions.title}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.suggestions.refresh}
            onPress={refreshIdeas}
            disabled={refreshing}
            accessibilityState={{ disabled: refreshing, busy: refreshing }}
            style={({ pressed }) => [styles.suggestionsRefresh, { alignItems: direction === "rtl" ? "flex-start" : "flex-end" }, pressed && styles.pressed]}
          >
            <Animated.View style={{ transform: [{ rotate: refreshSpin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }}>
              <NativeIcon name="redraw" size={18} color={NATIVE_COLORS.moss} />
            </Animated.View>
          </Pressable>
        </View>
        <Animated.View style={[styles.suggestionsList, { opacity: suggestionOpacity, transform: [{ translateY: suggestionOffset }] }]}>
        {copy.suggestions.items.map((suggestion) => (
          <Pressable
            key={suggestion}
            accessibilityRole="button"
            accessibilityLabel={suggestion}
            disabled={refreshing}
            onPress={() => onSelectSuggestion(suggestion)}
            style={({ pressed }) => [styles.suggestion, { flexDirection: nativeRowDirection(direction) }, pressed && styles.pressed]}
          >
            <Text style={[styles.suggestionText, { fontFamily: nativeFontFamily(locale, "body"), textAlign: nativeTextAlign(direction) }]}>{suggestion}</Text>
            <NativeIcon name="chevronForward" size={18} color={NATIVE_COLORS.moss} />
          </Pressable>
        ))}
        </Animated.View>
      </View>
    </View>
  );
}

function NativeWaitingCard({ locale, copy, direction, reducedMotion, state }: NativeCreateViewProps & { state: Extract<NativeGenerationUiState, { status: "waiting" }> }) {
  const [messageIndex, setMessageIndex] = useState(() => state.loadingMessageIndex);
  const { width } = useWindowDimensions();
  const animationSize = Math.min(230, Math.max(170, width - 76));

  useEffect(() => {
    if (reducedMotion || state.loadingMessages.length < 2) return;
    const timer = setInterval(() => {
      setMessageIndex((current) => (current + 1) % state.loadingMessages.length);
    }, 4200);
    return () => clearInterval(timer);
  }, [reducedMotion, state.loadingMessages]);

  const message = loadingMessageAt(state.loadingMessages, messageIndex);
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={state.statusLabel} style={styles.waitingCard}>
      <LottieView
        autoPlay={!reducedMotion}
        loop={!reducedMotion}
        progress={reducedMotion ? 0.75 : undefined}
        source={PEN_DRAW_ANIMATION}
        style={[styles.waitingAnimation, { height: animationSize, width: animationSize }]}
      />
      <Text style={[styles.loadingPrimary, { fontFamily: nativeFontFamily(locale, "display"), textAlign: nativeTextAlign(direction) }]}>
        {copy.stage.loadingPrimary}
      </Text>
      <View style={styles.loadingMessageSlot}>
        <Text style={[styles.loadingMessage, { fontFamily: nativeFontFamily(locale, "body"), textAlign: nativeTextAlign(direction) }]}>
          {message}
        </Text>
      </View>
      <Text style={styles.srOnly} accessibilityLiveRegion="polite">{state.statusLabel}</Text>
    </View>
  );
}

function NativeResultCard({ locale, direction, copy, state, usage, reducedMotion, onDownload, onShare, onNewScene, onResultBack, onOpenMore, onOpenLarger, gridEnabled = false, onToggleGrid }: NativeCreateViewProps & { state: Extract<NativeGenerationUiState, { status: "ready" }> }) {
  const reveal = useMemo(() => new Animated.Value(0), []);
  const { width } = useWindowDimensions();
  const compactActions = width < 360;

  useEffect(() => {
    reveal.setValue(0);
    const animation = Animated.timing(reveal, {
      toValue: 1,
      duration: reducedMotion ? 0 : 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [reducedMotion, reveal, state.imageUri]);

  const revealY = reveal.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  return (
    <Animated.View style={[styles.resultScreen, { opacity: reveal, transform: [{ translateY: revealY }] }]}> 
      <View style={[styles.resultHeader, { alignItems: direction === "rtl" ? "flex-end" : "flex-start" }]}> 
        <Pressable accessibilityRole="button" accessibilityLabel={copy.navigation.create} onPress={onResultBack} style={({ pressed }) => [styles.resultBackButton, pressed && styles.pressed]}> 
          <NativeIcon name="back" size={23} color={NATIVE_COLORS.graphite} />
        </Pressable>
      </View>
      <NativeDoodleGridFrame locale={locale} direction={direction} reducedMotion={reducedMotion} enabled={gridEnabled} onToggle={onToggleGrid} style={styles.resultGridFrame}>
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel={copy.stage.viewLarger}
        onPress={onOpenLarger}
        style={({ pressed }) => [styles.resultImageFrame, pressed && styles.pressed]}
      >
        <Image source={state.imageUri} contentFit="contain" style={styles.resultImage} accessibilityLabel={state.imageAlt} />
      </Pressable>
      </NativeDoodleGridFrame>

      <View style={[styles.resultActionRow, compactActions && styles.resultActionRowCompact, { flexDirection: compactActions ? "column" : nativeRowDirection(direction) }]}>
        <ResultAction compact={compactActions} locale={locale} icon="download" label={copy.actions.download} onPress={onDownload} primary />
        <ResultAction compact={compactActions} locale={locale} icon="share" label={copy.result.share} onPress={onShare} />
      </View>
      <View style={[styles.resultActionRow, { flexDirection: nativeRowDirection(direction) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.actions.newScene}
          onPress={onNewScene}
          style={({ pressed }) => [styles.newSceneButton, pressed && styles.pressed]}
        >
          <Text style={[styles.newSceneText, { fontFamily: nativeFontFamily(locale, "body") }]}>{copy.actions.newScene}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.result.more}
          onPress={onOpenMore}
          style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}
        >
          <NativeIcon name="more" size={23} color={NATIVE_COLORS.graphite} />
        </Pressable>
      </View>
      <Text style={[styles.usageLabel, { fontFamily: nativeFontFamily(locale, "body"), textAlign: nativeTextAlign(direction) }]}>{usage.label}</Text>
    </Animated.View>
  );
}

function ResultAction({ compact, locale, icon, label, onPress, primary = false }: { compact?: boolean; locale: NativeLocale; icon: "download" | "share"; label: string; onPress(): void; primary?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.resultAction, compact && styles.resultActionCompact, primary ? styles.resultActionPrimary : styles.resultActionSecondary, pressed && styles.pressed]}
    >
      <NativeIcon name={icon} size={19} color={primary ? NATIVE_COLORS.white : NATIVE_COLORS.moss} />
      <Text style={[styles.resultActionText, { color: primary ? NATIVE_COLORS.white : NATIVE_COLORS.moss, fontFamily: nativeFontFamily(locale, "body") }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { gap: 24, paddingBottom: 24, paddingHorizontal: NATIVE_SPACING.screen, paddingTop: 14 },
  waitingScrollContent: { flexGrow: 1, justifyContent: "center" },
  composerScreen: { gap: 24 },
  compactComposerScreen: { gap: 20 },
  composerBlock: { gap: 11 },
  compactComposerBlock: { gap: 9 },
  composerTitle: { color: NATIVE_COLORS.graphite, fontSize: 25, fontWeight: "600", lineHeight: 29 },
  composerHint: { color: NATIVE_COLORS.muted, fontSize: 16, lineHeight: 22 },
  inputStack: {},
  detailRow: { alignItems: "flex-end", gap: 8 },
  sceneHeading: { flex: 1, minWidth: 0, gap: 5, paddingBottom: 12 },
  scenePaper: { zIndex: 1, backgroundColor: NATIVE_COLORS.paper, borderColor: NATIVE_COLORS.line, borderRadius: 16, borderWidth: 1 },
  sceneInput: { color: NATIVE_COLORS.graphite, fontSize: 17, lineHeight: 24, minHeight: 118, paddingHorizontal: 16, paddingVertical: 16, textAlignVertical: "top" },
  compactSceneInput: { fontSize: 16, lineHeight: 22 },
  sceneInputFocused: { borderColor: NATIVE_COLORS.moss },
  composerFooter: { alignItems: "center", gap: 12, justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 12 },
  composerFooterStacked: { alignItems: "stretch" },
  composerUsage: { color: NATIVE_COLORS.muted, fontSize: 13, lineHeight: 19 },
  characterCountSlot: { flex: 1, justifyContent: "center", minHeight: 18 },
  characterCountSlotStacked: { flex: 0 },
  characterCount: { color: NATIVE_COLORS.muted, fontSize: 12, lineHeight: 18 },
  createButton: { alignItems: "center", backgroundColor: NATIVE_COLORS.moss, borderRadius: 12, justifyContent: "center", minHeight: NATIVE_SPACING.control, paddingHorizontal: 18 },
  createButtonStacked: { width: "100%" },
  createButtonText: { color: NATIVE_COLORS.white, fontSize: 15, fontWeight: "700" },
  disabledButton: { opacity: 0.4 },
  suggestionsBlock: { gap: 4 },
  suggestionsHeading: { alignItems: "center", gap: 12, justifyContent: "space-between" },
  suggestionsList: { gap: 8 },
  suggestionsRefresh: { alignItems: "center", borderRadius: 8, height: NATIVE_SPACING.control, justifyContent: "center", width: NATIVE_SPACING.control, flexShrink: 0 },
  suggestionsTitle: { color: NATIVE_COLORS.graphite, flex: 1, fontSize: 22, fontWeight: "600", lineHeight: 28 },
  compactSuggestionsTitle: { fontSize: 20, lineHeight: 24 },
  arabicSuggestionsTitle: { lineHeight: 34 },
  suggestion: { alignItems: "center", backgroundColor: NATIVE_COLORS.paper, borderColor: NATIVE_COLORS.softLine, borderRadius: 12, borderWidth: 1, gap: 10, justifyContent: "space-between", minHeight: NATIVE_SPACING.control, paddingHorizontal: 14, paddingVertical: 10 },
  suggestionText: { color: NATIVE_COLORS.graphite, flex: 1, fontSize: 14, lineHeight: 20 },
  errorBanner: { alignItems: "center", backgroundColor: NATIVE_COLORS.dangerSurface, borderColor: "rgba(182, 82, 72, 0.24)", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 9, padding: 12 },
  errorText: { color: NATIVE_COLORS.graphite, flex: 1, fontSize: 14, lineHeight: 20 },
  errorRetry: { minHeight: 40, justifyContent: "center", paddingHorizontal: 4 },
  errorRetryText: { color: NATIVE_COLORS.coral, fontSize: 14, fontWeight: "700" },
  waitingCard: { alignItems: "center", backgroundColor: NATIVE_COLORS.loadingYellow, borderRadius: 18, gap: 8, justifyContent: "center", maxHeight: 420, minHeight: 350, overflow: "hidden", padding: 20, width: "100%" },
  waitingAnimation: {},
  loadingPrimary: { color: NATIVE_COLORS.graphite, fontSize: 20, fontWeight: "600", lineHeight: 27, textAlign: "center" },
  loadingMessageSlot: { alignItems: "center", justifyContent: "center", minHeight: 58, width: "100%" },
  loadingMessage: { color: NATIVE_COLORS.muted, fontSize: 13, lineHeight: 20, textAlign: "center" },
  srOnly: { height: 1, opacity: 0, position: "absolute", width: 1 },
  resultScreen: { gap: 14 },
  resultHeader: { minHeight: 48, width: "100%" },
  resultBackButton: { alignItems: "center", borderRadius: 12, height: 48, justifyContent: "center", width: 48 },
  resultImageFrame: { alignSelf: "center", aspectRatio: 1, backgroundColor: NATIVE_COLORS.sticky, borderRadius: 16, maxHeight: 330, overflow: "hidden", width: "100%" },
  resultImage: { height: "100%", width: "100%" },
  resultGridFrame: { alignSelf: "center", width: "100%", maxWidth: 330 },
  resultActionRow: { alignItems: "center", gap: 10 },
  resultActionRowCompact: { width: "100%" },
  resultAction: { alignItems: "center", borderRadius: 12, flex: 1, flexDirection: "row", gap: 7, justifyContent: "center", minHeight: NATIVE_SPACING.control, minWidth: 0, paddingHorizontal: 10 },
  resultActionCompact: { alignSelf: "stretch", flex: 0, paddingHorizontal: 14, width: "100%" },
  resultActionPrimary: { backgroundColor: NATIVE_COLORS.moss },
  resultActionSecondary: { backgroundColor: NATIVE_COLORS.paper, borderColor: NATIVE_COLORS.moss, borderWidth: 1 },
  resultActionText: { flexShrink: 1, fontSize: 14, fontWeight: "700", minWidth: 0 },
  newSceneButton: { alignItems: "center", borderColor: NATIVE_COLORS.line, borderRadius: 12, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: NATIVE_SPACING.control, paddingHorizontal: 12 },
  newSceneText: { color: NATIVE_COLORS.graphite, fontSize: 14, fontWeight: "600", textAlign: "center" },
  moreButton: { alignItems: "center", borderColor: NATIVE_COLORS.line, borderRadius: 12, borderWidth: 1, height: NATIVE_SPACING.control, justifyContent: "center", width: NATIVE_SPACING.control },
  usageLabel: { color: NATIVE_COLORS.muted, fontSize: 13, lineHeight: 20, paddingHorizontal: 2 },
  pressed: { opacity: 0.72 },
});
