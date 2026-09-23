import { Image } from "expo-image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeIcon } from "./NativeIcon";
import { NATIVE_COLORS, NATIVE_SPACING, nativeFontFamily, nativeRowDirection, nativeTextAlign } from "./theme";
import { NATIVE_REPORT_DETAILS_MAX_LENGTH } from "./types";
import type {
  NativeAccountModalState,
  NativeAccountUi,
  NativeDirection,
  NativeDoodleUiCopy,
  NativeImageSource,
  NativeLocale,
  NativePurchaseUi,
  NativeReportUiState,
  NativeReportSubmission,
} from "./types";
import { canSubmitReport } from "./ui-logic";

interface NativeModalFrameProps {
  visible: boolean;
  title: string;
  closeLabel: string;
  locale: NativeLocale;
  direction: NativeDirection;
  onClose(): void;
  children: ReactNode;
  contentKey: string;
  dismissible?: boolean;
  onExitComplete?(): void;
}

const MODAL_SHEET_OFFSET = 44;

function NativeModalFrame({ visible, title, closeLabel, locale, direction, onClose, children, contentKey, dismissible = true, onExitComplete }: NativeModalFrameProps) {
  const [mounted, setMounted] = useState(false);
  const [scrimOpacity] = useState(() => new Animated.Value(0));
  const [sheetTranslateY] = useState(() => new Animated.Value(MODAL_SHEET_OFFSET));
  const [retainedFrame, setRetainedFrame] = useState(() => ({ title, closeLabel, locale, direction, children }));
  const [retainedFrameKey, setRetainedFrameKey] = useState<string | undefined>();
  const [layoutReady, setLayoutReady] = useState(false);
  const mountedRef = useRef(false);
  const visibleRef = useRef(visible);
  const reduceMotionRef = useRef(false);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const animationGenerationRef = useRef(0);
  const closeRequestedRef = useRef(false);
  const layoutReadyRef = useRef(false);
  const layoutRevisionRef = useRef(0);
  const layoutCheckFrameRef = useRef<number | null>(null);
  const modalShownRef = useRef(false);
  const entranceStartedRef = useRef(false);
  const frameKey = `${title}\u0001${closeLabel}\u0001${locale}\u0001${direction}\u0001${contentKey}`;

  useEffect(() => {
    if (!visible || retainedFrameKey === frameKey) return;
    const cacheFrame = setTimeout(() => {
      setRetainedFrame({ title, closeLabel, locale, direction, children });
      setRetainedFrameKey(frameKey);
    }, 0);
    return () => clearTimeout(cacheFrame);
  }, [children, closeLabel, direction, frameKey, locale, retainedFrameKey, title, visible]);

  const frame = visible ? { title, closeLabel, locale, direction, children } : retainedFrame;

  const stopAnimation = useCallback(() => {
    animationGenerationRef.current += 1;
    animationRef.current?.stop();
    animationRef.current = null;
  }, []);

  const finishExit = useCallback(() => {
    const exitGeneration = animationGenerationRef.current;
    mountedRef.current = false;
    setMounted(false);
    if (onExitComplete) {
      setTimeout(() => {
        if (!mountedRef.current && !visible && animationGenerationRef.current === exitGeneration) onExitComplete();
      }, 0);
    }
  }, [onExitComplete, visible]);

  const startAnimation = useCallback((animation: Animated.CompositeAnimation, onFinished?: (finished: boolean) => void) => {
    const animationGeneration = animationGenerationRef.current + 1;
    animationGenerationRef.current = animationGeneration;
    animationRef.current = animation;
    animation.start(({ finished }) => {
      if (animationGenerationRef.current !== animationGeneration) return;
      animationRef.current = null;
      onFinished?.(finished);
    });
  }, []);

  const cancelLayoutCheck = useCallback(() => {
    if (layoutCheckFrameRef.current === null) return;
    cancelAnimationFrame(layoutCheckFrameRef.current);
    layoutCheckFrameRef.current = null;
  }, []);

  const animateIn = useCallback(() => {
    stopAnimation();
    if (reduceMotionRef.current) {
      scrimOpacity.setValue(1);
      sheetTranslateY.setValue(0);
      return;
    }
    startAnimation(Animated.parallel([
      Animated.timing(scrimOpacity, { duration: 160, easing: Easing.out(Easing.cubic), toValue: 1, useNativeDriver: true }),
      Animated.timing(sheetTranslateY, { duration: 240, easing: Easing.out(Easing.cubic), toValue: 0, useNativeDriver: true }),
    ]));
  }, [scrimOpacity, sheetTranslateY, startAnimation, stopAnimation]);

  const startEntrance = useCallback(() => {
    if (!visibleRef.current || !mountedRef.current || !layoutReadyRef.current || !modalShownRef.current || entranceStartedRef.current) return;
    entranceStartedRef.current = true;
    animateIn();
  }, [animateIn]);

  const handleSheetLayout = useCallback((event: LayoutChangeEvent) => {
    if (!visibleRef.current || !mountedRef.current || entranceStartedRef.current) return;
    const { height, width } = event.nativeEvent.layout;
    if (height <= 0 || width <= 0) return;
    layoutReadyRef.current = false;
    setLayoutReady(false);
    cancelLayoutCheck();
    const layoutRevision = layoutRevisionRef.current + 1;
    layoutRevisionRef.current = layoutRevision;
    layoutCheckFrameRef.current = requestAnimationFrame(() => {
      if (!visibleRef.current || !mountedRef.current || entranceStartedRef.current || layoutRevisionRef.current !== layoutRevision) return;
      layoutCheckFrameRef.current = requestAnimationFrame(() => {
        layoutCheckFrameRef.current = null;
        if (!visibleRef.current || !mountedRef.current || entranceStartedRef.current || layoutRevisionRef.current !== layoutRevision) return;
        layoutReadyRef.current = true;
        setLayoutReady(true);
        startEntrance();
      });
    });
  }, [cancelLayoutCheck, startEntrance]);

  useLayoutEffect(() => {
    visibleRef.current = visible;
    cancelLayoutCheck();
    if (!visible) {
      layoutRevisionRef.current += 1;
      return;
    }
    layoutRevisionRef.current += 1;
    layoutReadyRef.current = false;
    modalShownRef.current = false;
    entranceStartedRef.current = false;
    // Reset before the next native frame so a reopened sheet cannot expose stale layout.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLayoutReady(false);
  }, [cancelLayoutCheck, visible]);

  const animateOut = useCallback(() => {
    stopAnimation();
    if (reduceMotionRef.current) {
      scrimOpacity.setValue(0);
      sheetTranslateY.setValue(MODAL_SHEET_OFFSET);
      finishExit();
      return;
    }
    startAnimation(Animated.parallel([
      Animated.timing(scrimOpacity, { duration: 120, easing: Easing.in(Easing.cubic), toValue: 0, useNativeDriver: true }),
      Animated.timing(sheetTranslateY, { duration: 190, easing: Easing.in(Easing.cubic), toValue: MODAL_SHEET_OFFSET, useNativeDriver: true }),
    ]), (finished) => {
      if (finished && !visible) finishExit();
    });
  }, [finishExit, scrimOpacity, sheetTranslateY, startAnimation, stopAnimation, visible]);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!active) return;
      reduceMotionRef.current = enabled;
      if (enabled && mountedRef.current) {
        stopAnimation();
        if (visible) {
          scrimOpacity.setValue(1);
          sheetTranslateY.setValue(0);
        } else {
          scrimOpacity.setValue(0);
          sheetTranslateY.setValue(MODAL_SHEET_OFFSET);
          finishExit();
        }
      }
    }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      reduceMotionRef.current = enabled;
      if (!enabled || !mountedRef.current) return;
      stopAnimation();
      if (visible) {
        scrimOpacity.setValue(1);
        sheetTranslateY.setValue(0);
      } else {
        scrimOpacity.setValue(0);
        sheetTranslateY.setValue(MODAL_SHEET_OFFSET);
        finishExit();
      }
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [finishExit, scrimOpacity, sheetTranslateY, stopAnimation, visible]);

  useEffect(() => {
    if (visible) {
      closeRequestedRef.current = false;
      stopAnimation();
      if (!mountedRef.current) {
        scrimOpacity.setValue(0);
        sheetTranslateY.setValue(MODAL_SHEET_OFFSET);
        mountedRef.current = true;
        setMounted(true);
      } else {
        startEntrance();
      }
    } else if (mountedRef.current) {
      animateOut();
    }
  }, [animateIn, animateOut, scrimOpacity, sheetTranslateY, startEntrance, stopAnimation, visible]);

  useEffect(() => () => {
    cancelLayoutCheck();
    stopAnimation();
  }, [cancelLayoutCheck, stopAnimation]);

  const handleShow = useCallback(() => {
    if (!visibleRef.current) return;
    modalShownRef.current = true;
    startEntrance();
  }, [startEntrance]);
  const handleRequestClose = useCallback(() => {
    if (!visible || !dismissible || closeRequestedRef.current) return;
    closeRequestedRef.current = true;
    onClose();
  }, [dismissible, onClose, visible]);

  if (!mounted) return null;
  return (
    <Modal
      animationType="none"
      navigationBarTranslucent
      onRequestClose={handleRequestClose}
      onShow={handleShow}
      statusBarTranslucent
      transparent
      visible
    >
      <View accessibilityElementsHidden={!visible || !layoutReady} importantForAccessibility={visible && layoutReady ? "yes" : "no-hide-descendants"} pointerEvents={visible && layoutReady ? "auto" : "none"} style={styles.modalRoot}>
        <Animated.View style={[styles.scrim, { opacity: scrimOpacity }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={frame.closeLabel} accessibilityState={{ disabled: !dismissible }} disabled={!dismissible} onPress={handleRequestClose} style={styles.scrimTouchTarget} />
        </Animated.View>
        <Animated.View accessibilityViewIsModal onLayout={handleSheetLayout} style={[styles.sheet, { opacity: layoutReady ? 1 : 0, transform: [{ translateY: sheetTranslateY }] }]}>
          <SafeAreaView edges={["top", "bottom"]} style={styles.sheetSafe}>
            <View style={[styles.sheetHeader, { flexDirection: nativeRowDirection(frame.direction) }]}>
              <Text accessibilityRole="header" style={[styles.sheetTitle, { fontFamily: nativeFontFamily(frame.locale, "display"), textAlign: nativeTextAlign(frame.direction) }]}>
                {frame.title}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel={frame.closeLabel} accessibilityState={{ disabled: !dismissible }} disabled={!dismissible} onPress={handleRequestClose} style={({ pressed }) => [styles.closeButton, !dismissible && styles.closeButtonDisabled, pressed && dismissible && styles.pressed]}>
                <NativeIcon name="close" size={23} color={NATIVE_COLORS.graphite} />
              </Pressable>
            </View>
            {frame.children}
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

export interface NativeMoreModalProps {
  locale: NativeLocale;
  direction: NativeDirection;
  copy: NativeDoodleUiCopy;
  visible: boolean;
  onClose(): void;
  onRedraw(): void;
  onOpenReport(): void;
}

export function NativeMoreModal({ locale, direction, copy, visible, onClose, onRedraw, onOpenReport }: NativeMoreModalProps) {
  const pendingActionRef = useRef<(() => void) | null>(null);
  const actionHandledRef = useRef(false);
  useEffect(() => {
    if (visible) {
      pendingActionRef.current = null;
      actionHandledRef.current = false;
    }
  }, [visible]);
  const handleExitComplete = useCallback(() => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    action?.();
  }, []);
  const handleOpenReport = useCallback(() => {
    if (actionHandledRef.current) return;
    actionHandledRef.current = true;
    pendingActionRef.current = onOpenReport;
    onClose();
  }, [onClose, onOpenReport]);
  const handleRedraw = useCallback(() => {
    if (actionHandledRef.current) return;
    actionHandledRef.current = true;
    onClose();
    onRedraw();
  }, [onClose, onRedraw]);
  return (
    <NativeModalFrame contentKey="more" onExitComplete={handleExitComplete} visible={visible} title={copy.result.more} closeLabel={copy.dialog.close} locale={locale} direction={direction} onClose={onClose}>
      <View style={styles.modalBody}>
        <ModalAction locale={locale} icon="redraw" label={copy.actions.redraw} onPress={handleRedraw} />
        <ModalAction locale={locale} icon="report" label={copy.result.report} onPress={handleOpenReport} destructive />
      </View>
    </NativeModalFrame>
  );
}

function ModalAction({ locale, icon, label, onPress, destructive = false }: { locale: NativeLocale; icon: "redraw" | "report" | "download" | "signIn" | "signOut" | "delete" | "addCircle"; label: string; onPress(): void; destructive?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.modalAction, destructive && styles.modalActionDanger, pressed && styles.pressed]}>
      <NativeIcon name={icon} size={21} color={destructive ? NATIVE_COLORS.coral : NATIVE_COLORS.moss} />
      <Text style={[styles.modalActionText, { color: destructive ? NATIVE_COLORS.coral : NATIVE_COLORS.graphite, fontFamily: nativeFontFamily(locale, "body") }]}>{label}</Text>
    </Pressable>
  );
}

export interface NativePurchaseModalProps {
  locale: NativeLocale;
  direction: NativeDirection;
  copy: NativeDoodleUiCopy;
  purchase?: NativePurchaseUi;
  onCancel(): void;
  onPurchase(): void;
  onRestore(): void;
  onSignIn(): void;
  onNewScene(): void;
}

export function NativePurchaseModal({ locale, direction, copy, purchase, onCancel, onPurchase, onRestore, onSignIn, onNewScene }: NativePurchaseModalProps) {
  if (!purchase?.visible) {
    return (
      <NativeModalFrame contentKey="purchase" visible={false} title={purchase?.title || copy.purchase.title} closeLabel={purchase?.cancelLabel || copy.dialog.close} locale={locale} direction={direction} onClose={onCancel}>
        {null}
      </NativeModalFrame>
    );
  }
  const isSignIn = purchase.mode === "signIn";
  const isSuccess = purchase.mode === "success";
  const isError = purchase.mode === "error";
  const isCheckout = purchase.mode === "checkout";
  const buyLabel = purchase.buyLabel || copy.purchase.buy;
  const signInLabel = purchase.signInLabel || copy.auth.google || copy.auth.signIn;

  return (
    <NativeModalFrame contentKey={`${purchase.mode}:${purchase.busy}:${purchase.priceLabel || ""}:${purchase.errorLabel || ""}:${purchase.restoreLabel || ""}`} dismissible={!purchase.busy} visible title={purchase.title} closeLabel={purchase.cancelLabel || copy.dialog.close} locale={locale} direction={direction} onClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardAvoiding}>
        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled" style={styles.modalScroll}>
          {isSignIn ? (
            <>
              <Text style={[styles.modalParagraph, { fontFamily: nativeFontFamily(locale, "body"), textAlign: nativeTextAlign(direction) }]}>{purchase.body}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={signInLabel} onPress={onSignIn} style={({ pressed }) => [styles.primaryModalButton, pressed && styles.pressed]}>
                <NativeIcon name="signIn" size={20} color={NATIVE_COLORS.white} />
                <Text style={[styles.primaryModalButtonText, { fontFamily: nativeFontFamily(locale, "body") }]}>{signInLabel}</Text>
              </Pressable>
            </>
          ) : null}

          {!isSignIn && !isSuccess ? (
            <>
              <View style={styles.offerDetails}>
                <View style={[styles.offerRow, { flexDirection: nativeRowDirection(direction) }]}>
                  <Text style={[styles.offerQuantity, { fontFamily: nativeFontFamily(locale, "display"), textAlign: nativeTextAlign(direction) }]}>{purchase.quantityLabel}</Text>
                  {purchase.priceLabel ? <Text style={[styles.offerPrice, { fontFamily: nativeFontFamily(locale, "body"), textAlign: nativeTextAlign(direction) }]}>{purchase.priceLabel}</Text> : null}
                </View>
                <Text style={[styles.offerTerms, { fontFamily: nativeFontFamily(locale, "body"), textAlign: nativeTextAlign(direction) }]}>{purchase.termsLabel}</Text>
              </View>
              {purchase.failedGenerationsLabel ? <Text style={[styles.offerFinePrint, { fontFamily: nativeFontFamily(locale, "body"), textAlign: nativeTextAlign(direction) }]}>{purchase.failedGenerationsLabel}</Text> : null}
              {isError && purchase.errorLabel ? <Text accessibilityRole="alert" style={[styles.purchaseError, { fontFamily: nativeFontFamily(locale, "body"), textAlign: nativeTextAlign(direction) }]}>{purchase.errorLabel}</Text> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={buyLabel}
                accessibilityState={{ busy: purchase.busy, disabled: purchase.busy }}
                disabled={purchase.busy}
                onPress={onPurchase}
                style={({ pressed }) => [styles.primaryModalButton, purchase.busy && styles.disabledButton, pressed && !purchase.busy && styles.pressed]}
              >
                {isCheckout || purchase.busy ? <ActivityIndicator color={NATIVE_COLORS.white} /> : <NativeIcon name="addCircle" size={20} color={NATIVE_COLORS.white} />}
                <Text style={[styles.primaryModalButtonText, { fontFamily: nativeFontFamily(locale, "body") }]}>{buyLabel}</Text>
              </Pressable>
              {purchase.restoreLabel ? <Pressable accessibilityRole="button" accessibilityLabel={purchase.restoreLabel} disabled={purchase.busy} onPress={onRestore} style={({ pressed }) => [styles.quietModalButton, pressed && styles.pressed]}><Text style={[styles.quietModalButtonText, { fontFamily: nativeFontFamily(locale, "body") }]}>{purchase.restoreLabel}</Text></Pressable> : null}
            </>
          ) : null}

          {isSuccess ? (
            <>
              <View style={styles.successIcon}><NativeIcon name="check" size={28} color={NATIVE_COLORS.moss} /></View>
              <Text style={[styles.modalParagraph, { fontFamily: nativeFontFamily(locale, "body"), textAlign: nativeTextAlign(direction) }]}>{purchase.body}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={copy.purchase.startDrawing} onPress={onNewScene} style={({ pressed }) => [styles.primaryModalButton, pressed && styles.pressed]}>
                <Text style={[styles.primaryModalButtonText, { fontFamily: nativeFontFamily(locale, "body") }]}>{copy.purchase.startDrawing}</Text>
              </Pressable>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </NativeModalFrame>
  );
}

export interface NativeReportModalProps {
  locale: NativeLocale;
  direction: NativeDirection;
  copy: NativeDoodleUiCopy;
  visible: boolean;
  reportState: NativeReportUiState;
  onClose(): void;
  onSubmit(report: NativeReportSubmission): void;
}

const REPORT_REASONS = ["sexual", "violence", "hate", "self-harm", "other"] as const;

export function NativeReportModal({ locale, direction, copy, visible, reportState, onClose, onSubmit }: NativeReportModalProps) {
  return <NativeReportForm visible={visible} locale={locale} direction={direction} copy={copy} reportState={reportState} onClose={onClose} onSubmit={onSubmit} />;
}

function NativeReportForm({ visible, locale, direction, copy, reportState, onClose, onSubmit }: NativeReportModalProps) {
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [includeContent, setIncludeContent] = useState(false);
  const resetForm = useCallback(() => {
    setReason("");
    setDetails("");
    setIncludeContent(false);
  }, []);

  const detailsRequired = reason === "other";
  const disabled = !canSubmitReport(reason, details, reportState.pending);
  return (
    <NativeModalFrame contentKey={`report:${reason}:${details.length}:${includeContent}:${reportState.pending}:${reportState.error || ""}`} dismissible={!reportState.pending} onExitComplete={resetForm} visible={visible} title={copy.report.title} closeLabel={copy.report.close} locale={locale} direction={direction} onClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardAvoiding}>
        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled" style={styles.modalScroll}>
          <Text style={[styles.modalParagraph, { fontFamily: nativeFontFamily(locale, "body"), textAlign: nativeTextAlign(direction) }]}>{copy.report.intro}</Text>
          <Text style={[styles.fieldLabel, { fontFamily: nativeFontFamily(locale, "body"), textAlign: nativeTextAlign(direction) }]}>{copy.report.reasonLabel}</Text>
          <View style={styles.reasonList}>
            {REPORT_REASONS.map((item) => {
              const selected = reason === item;
              return (
                <Pressable key={item} accessibilityRole="radio" accessibilityLabel={copy.report.reasons[item]} accessibilityState={{ selected, disabled: reportState.pending }} disabled={reportState.pending} onPress={() => setReason(item)} style={({ pressed }) => [styles.reasonRow, selected && styles.reasonSelected, pressed && styles.pressed]}>
                  <Text style={[styles.reasonText, { fontFamily: nativeFontFamily(locale, "body") }]}>{copy.report.reasons[item]}</Text>
                  {selected ? <NativeIcon name="check" size={19} color={NATIVE_COLORS.moss} /> : null}
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.fieldLabel, { fontFamily: nativeFontFamily(locale, "body"), textAlign: nativeTextAlign(direction) }]}>{detailsRequired ? copy.report.detailsRequired : copy.report.detailsOptional}</Text>
          <TextInput accessibilityLabel={detailsRequired ? copy.report.detailsRequired : copy.report.detailsOptional} editable={!reportState.pending} maxLength={NATIVE_REPORT_DETAILS_MAX_LENGTH} multiline onChangeText={setDetails} placeholder={copy.report.detailsPlaceholder} placeholderTextColor={NATIVE_COLORS.muted} selectionColor={NATIVE_COLORS.moss} style={[styles.detailsInput, { fontFamily: nativeFontFamily(locale, "body"), textAlign: nativeTextAlign(direction) }]} value={details} />
          <View style={styles.includeRow}>
            <Switch accessibilityLabel={copy.report.includeContent} disabled={reportState.pending} onValueChange={setIncludeContent} thumbColor={NATIVE_COLORS.paper} trackColor={{ false: NATIVE_COLORS.line, true: NATIVE_COLORS.moss }} value={includeContent} />
            <Text style={[styles.includeText, { fontFamily: nativeFontFamily(locale, "body"), textAlign: nativeTextAlign(direction) }]}>{copy.report.includeContent}</Text>
          </View>
          {reportState.error ? <Text accessibilityRole="alert" style={[styles.reportError, { fontFamily: nativeFontFamily(locale, "body"), textAlign: nativeTextAlign(direction) }]}>{reportState.error}</Text> : null}
          <Pressable accessibilityRole="button" accessibilityLabel={copy.report.submit} accessibilityState={{ busy: reportState.pending, disabled }} disabled={disabled} onPress={() => onSubmit({ reason, details: details.trim(), includeContent })} style={({ pressed }) => [styles.primaryModalButton, disabled && styles.disabledButton, pressed && !disabled && styles.pressed]}>
            {reportState.pending ? <ActivityIndicator color={NATIVE_COLORS.white} /> : null}
            <Text style={[styles.primaryModalButtonText, { fontFamily: nativeFontFamily(locale, "body") }]}>{copy.report.submit}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </NativeModalFrame>
  );
}

export interface NativeImageModalProps {
  locale: NativeLocale;
  copy: NativeDoodleUiCopy;
  direction: NativeDirection;
  visible: boolean;
  imageUri: NativeImageSource;
  imageAlt: string;
  onClose(): void;
  onDownload(): void;
}

export function NativeImageModal({ locale, copy, direction, visible, imageUri, imageAlt, onClose, onDownload }: NativeImageModalProps) {
  if (!visible) return null;
  return (
    <Modal animationType="fade" navigationBarTranslucent onRequestClose={onClose} statusBarTranslucent visible>
      <SafeAreaView accessibilityViewIsModal edges={["top", "bottom"]} style={styles.viewerRoot}>
        <View style={[styles.viewerHeader, { flexDirection: nativeRowDirection(direction) }]}>
          <View style={styles.viewerHeaderSpacer} />
          <Pressable accessibilityRole="button" accessibilityLabel={copy.dialog.close} onPress={onClose} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
            <NativeIcon name="close" size={24} color={NATIVE_COLORS.graphite} />
          </Pressable>
        </View>
        <View style={styles.viewerImageFrame}>
          <Image accessibilityLabel={imageAlt} contentFit="contain" source={imageUri} style={styles.viewerImage} />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={copy.dialog.download} onPress={onDownload} style={({ pressed }) => [styles.viewerDownload, pressed && styles.pressed]}>
          <NativeIcon name="download" size={20} color={NATIVE_COLORS.white} />
          <Text style={[styles.primaryModalButtonText, { fontFamily: nativeFontFamily(locale, "body") }]}>{copy.dialog.download}</Text>
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

export interface NativeAccountModalProps {
  locale: NativeLocale;
  direction: NativeDirection;
  copy: NativeDoodleUiCopy;
  account: NativeAccountUi;
  state: NativeAccountModalState;
  onClose(): void;
  onSignIn(): void;
  onRefill(): void;
  onSignOut(): void;
  onDeleteRequest(): void;
  onDeleteConfirm(): void | PromiseLike<void>;
}

export function NativeAccountModal({ locale, direction, copy, account, state, onClose, onSignIn, onRefill, onSignOut, onDeleteRequest, onDeleteConfirm }: NativeAccountModalProps) {
  const visible = state !== "closed";
  const isSignIn = state === "signIn";
  const isDelete = state === "deleteConfirm";
  const pendingActionRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (visible) pendingActionRef.current = null;
  }, [visible]);
  const handleExitComplete = useCallback(() => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    action?.();
  }, []);
  const handleRefill = useCallback(() => {
    pendingActionRef.current = onRefill;
    onClose();
  }, [onClose, onRefill]);
  return (
    <NativeModalFrame contentKey={`account:${state}:${account.status}:${account.email || ""}:${account.balanceLabel}`} onExitComplete={handleExitComplete} visible={visible} title={isSignIn ? copy.auth.signIn : copy.account.label} closeLabel={copy.dialog.close} locale={locale} direction={direction} onClose={onClose}>
      <View style={styles.modalBody}>
        {isSignIn ? (
          <>
            <Text style={[styles.modalParagraph, { fontFamily: nativeFontFamily(locale, "body"), textAlign: nativeTextAlign(direction) }]}>{copy.auth.signIn}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={copy.auth.google} onPress={onSignIn} style={({ pressed }) => [styles.primaryModalButton, pressed && styles.pressed]}>
              <NativeIcon name="signIn" size={20} color={NATIVE_COLORS.white} />
              <Text style={[styles.primaryModalButtonText, { fontFamily: nativeFontFamily(locale, "body") }]}>{copy.auth.google}</Text>
            </Pressable>
          </>
        ) : null}

        {!isSignIn && !isDelete && account.status === "loading" ? <ActivityIndicator color={NATIVE_COLORS.moss} /> : null}
        {!isSignIn && !isDelete && account.status === "signedOut" ? <ModalAction locale={locale} icon="signIn" label={copy.auth.signIn} onPress={onSignIn} /> : null}
        {!isSignIn && !isDelete && account.status === "signedIn" ? (
          <>
            {account.email ? <Text style={[styles.accountEmail, { fontFamily: nativeFontFamily(locale, "body"), textAlign: nativeTextAlign(direction) }]}>{account.email}</Text> : null}
            <Text style={[styles.accountBalance, { fontFamily: nativeFontFamily(locale, "display"), textAlign: nativeTextAlign(direction) }]}>{account.balanceLabel}</Text>
            <ModalAction locale={locale} icon="addCircle" label={copy.purchase.label} onPress={handleRefill} />
            <ModalAction locale={locale} icon="signOut" label={copy.account.signOut} onPress={onSignOut} />
            <ModalAction locale={locale} icon="delete" label={copy.account.delete} onPress={onDeleteRequest} destructive />
          </>
        ) : null}

        {isDelete ? <NativeDeleteConfirmation locale={locale} direction={direction} copy={copy} onClose={onClose} onDeleteConfirm={onDeleteConfirm} /> : null}
      </View>
    </NativeModalFrame>
  );
}

function NativeDeleteConfirmation({ locale, direction, copy, onClose, onDeleteConfirm }: Pick<NativeAccountModalProps, "locale" | "direction" | "copy" | "onClose" | "onDeleteConfirm">) {
  const [pending, setPending] = useState(false);
  const handleConfirm = useCallback(() => {
    if (pending) return;
    setPending(true);
    let result: void | PromiseLike<void>;
    try {
      result = onDeleteConfirm();
    } catch {
      setPending(false);
      return;
    }
    if (result && typeof result.then === "function") {
      void result.then(
        () => setPending(false),
        () => setPending(false),
      );
    }
  }, [onDeleteConfirm, pending]);
  return (
    <>
      <Text accessibilityRole="alert" style={[styles.modalParagraph, { fontFamily: nativeFontFamily(locale, "body"), textAlign: nativeTextAlign(direction) }]}>{copy.account.deleteWarning}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={copy.account.confirmDelete} accessibilityState={{ busy: pending, disabled: pending }} disabled={pending} onPress={handleConfirm} style={({ pressed }) => [styles.dangerModalButton, pending && styles.disabledButton, pressed && !pending && styles.pressed]}>
        <NativeIcon name="delete" size={20} color={NATIVE_COLORS.white} />
        <Text style={[styles.primaryModalButtonText, { fontFamily: nativeFontFamily(locale, "body") }]}>{copy.account.confirmDelete}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={copy.account.cancelDelete} disabled={pending} onPress={onClose} style={({ pressed }) => [styles.quietModalButton, pressed && !pending && styles.pressed]}>
        <Text style={[styles.quietModalButtonText, { fontFamily: nativeFontFamily(locale, "body") }]}>{copy.account.cancelDelete}</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  scrim: { backgroundColor: NATIVE_COLORS.scrim, bottom: 0, left: 0, position: "absolute", right: 0, top: 0 },
  scrimTouchTarget: { bottom: 0, left: 0, position: "absolute", right: 0, top: 0 },
  sheetSafe: { flexShrink: 1, maxHeight: "100%", width: "100%" },
  sheet: { backgroundColor: NATIVE_COLORS.paper, borderTopLeftRadius: 22, borderTopRightRadius: 22, flexShrink: 1, maxHeight: "92%", overflow: "hidden", paddingBottom: 18, paddingHorizontal: NATIVE_SPACING.screen, paddingTop: 12, width: "100%" },
  sheetHeader: { alignItems: "center", justifyContent: "space-between", minHeight: 48 },
  sheetTitle: { color: NATIVE_COLORS.graphite, flex: 1, fontSize: 23, fontWeight: "600", lineHeight: 29 },
  closeButton: { alignItems: "center", borderRadius: 999, height: 44, justifyContent: "center", width: 44 },
  closeButtonDisabled: { opacity: 0.45 },
  keyboardAvoiding: { flexShrink: 1 },
  modalScroll: { flexShrink: 1 },
  modalBody: { gap: 12, paddingBottom: 8, paddingTop: 12 },
  modalAction: { alignItems: "center", borderColor: NATIVE_COLORS.line, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 11, minHeight: NATIVE_SPACING.control, paddingHorizontal: 14 },
  modalActionDanger: { backgroundColor: NATIVE_COLORS.dangerSurface, borderColor: "rgba(182, 82, 72, 0.24)" },
  modalActionText: { color: NATIVE_COLORS.graphite, flex: 1, fontSize: 15, fontWeight: "600" },
  modalParagraph: { color: NATIVE_COLORS.graphite, fontSize: 16, lineHeight: 24 },
  offerDetails: { backgroundColor: NATIVE_COLORS.selected, borderRadius: 14, gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  offerRow: { alignItems: "center", gap: 12, justifyContent: "space-between", width: "100%" },
  offerQuantity: { color: NATIVE_COLORS.moss, fontSize: 23, fontWeight: "600", lineHeight: 28 },
  offerPrice: { color: NATIVE_COLORS.graphite, fontSize: 18, fontWeight: "700", lineHeight: 24 },
  offerTerms: { color: NATIVE_COLORS.graphite, fontSize: 14, lineHeight: 20, textAlign: "center" },
  offerFinePrint: { color: NATIVE_COLORS.muted, fontSize: 13, lineHeight: 19, textAlign: "center" },
  purchaseError: { color: NATIVE_COLORS.coral, fontSize: 14, lineHeight: 20 },
  reportError: { color: NATIVE_COLORS.coral, fontSize: 14, lineHeight: 20 },
  primaryModalButton: { alignItems: "center", backgroundColor: NATIVE_COLORS.moss, borderRadius: 12, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: NATIVE_SPACING.control, paddingHorizontal: 16 },
  primaryModalButtonText: { color: NATIVE_COLORS.white, fontSize: 15, fontWeight: "700" },
  quietModalButton: { alignItems: "center", justifyContent: "center", minHeight: 44, paddingHorizontal: 10 },
  quietModalButtonText: { color: NATIVE_COLORS.moss, fontSize: 14, fontWeight: "700" },
  disabledButton: { opacity: 0.45 },
  successIcon: { alignItems: "center", alignSelf: "center", backgroundColor: NATIVE_COLORS.selected, borderRadius: 999, height: 56, justifyContent: "center", width: 56 },
  fieldLabel: { color: NATIVE_COLORS.graphite, fontSize: 14, fontWeight: "700", lineHeight: 20 },
  reasonList: { borderColor: NATIVE_COLORS.softLine, borderRadius: 13, borderWidth: 1, overflow: "hidden" },
  reasonRow: { alignItems: "center", borderBottomColor: NATIVE_COLORS.softLine, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", justifyContent: "space-between", minHeight: NATIVE_SPACING.control, paddingHorizontal: 13 },
  reasonSelected: { backgroundColor: NATIVE_COLORS.selected },
  reasonText: { color: NATIVE_COLORS.graphite, flex: 1, fontSize: 14, lineHeight: 20 },
  detailsInput: { backgroundColor: NATIVE_COLORS.white, borderColor: NATIVE_COLORS.line, borderRadius: 12, borderWidth: 1, color: NATIVE_COLORS.graphite, fontSize: 15, lineHeight: 22, minHeight: 88, paddingHorizontal: 13, paddingVertical: 11, textAlignVertical: "top" },
  includeRow: { alignItems: "center", flexDirection: "row", gap: 9, paddingVertical: 2 },
  includeText: { color: NATIVE_COLORS.muted, flex: 1, fontSize: 12, lineHeight: 18 },
  dangerModalButton: { alignItems: "center", backgroundColor: NATIVE_COLORS.coral, borderRadius: 12, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: NATIVE_SPACING.control, paddingHorizontal: 16 },
  viewerRoot: { backgroundColor: NATIVE_COLORS.paper, flex: 1, paddingHorizontal: NATIVE_SPACING.screen, paddingTop: 8 },
  viewerHeader: { alignItems: "center", justifyContent: "space-between", minHeight: 48 },
  viewerHeaderSpacer: { height: 44, width: 44 },
  viewerImageFrame: { alignItems: "center", flex: 1, justifyContent: "center", paddingVertical: 12 },
  viewerImage: { height: "100%", width: "100%" },
  viewerDownload: { alignItems: "center", backgroundColor: NATIVE_COLORS.moss, borderRadius: 12, flexDirection: "row", gap: 8, justifyContent: "center", marginBottom: 8, minHeight: NATIVE_SPACING.control, width: "100%" },
  accountEmail: { color: NATIVE_COLORS.muted, fontSize: 14, lineHeight: 20 },
  accountBalance: { color: NATIVE_COLORS.graphite, fontSize: 23, fontWeight: "600", lineHeight: 29, paddingBottom: 2 },
  pressed: { opacity: 0.72 },
});
