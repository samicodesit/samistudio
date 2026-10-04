import { useEffect, useState } from "react";
import { AccessibilityInfo, BackHandler, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeAccountSlot } from "./NativeAccountSlot";
import { NativeBottomTabs } from "./NativeBottomTabs";
import { NativeCreateView } from "./NativeCreateView";
import { NativeIdeasView } from "./NativeIdeasView";
import { NativeSettingsView } from "./NativeSettingsView";
import {
  NativeAccountModal,
  NativeImageModal,
  NativeMoreModal,
  NativePurchaseModal,
  NativeReportModal,
} from "./NativeModals";
import { NATIVE_COLORS, NATIVE_SPACING } from "./theme";
import type { NativeDoodleUiProps, NativeImageSource } from "./types";

export function DoodleAppView(props: NativeDoodleUiProps) {
  const reducedMotion = useReducedMotion();
  const [gridImageUri, setGridImageUri] = useState<NativeImageSource | null>(null);
  const gridEnabled = props.generation.status === "ready" && gridImageUri === props.generation.imageUri;
  const readyImage = props.generation.status === "ready" ? props.generation.imageUri : props.referenceImageUri;
  const readyAlt = props.generation.status === "ready" ? props.generation.imageAlt : props.copy.stage.referenceAlt;

  function startDoodle(action: () => void) {
    setGridImageUri(null);
    action();
  }

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (props.modal !== "none" || props.accountModal !== "closed" || props.tab !== "create" || props.generation.status !== "ready") return false;
      props.onResultBack();
      return true;
    });
    return () => subscription.remove();
  }, [props.accountModal, props.generation.status, props.modal, props.onResultBack, props.tab]);

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.root}>
        <View style={styles.accountHeader}>
          <NativeAccountSlot locale={props.locale} copy={props.copy} account={props.account} onPress={props.onOpenAccount} />
        </View>
        <View style={styles.content}>
          {props.tab === "create" ? (
            <NativeCreateView
              detailLevel={props.detailLevel}
              detailReady={props.detailReady}
              onDetailLevelChange={props.onDetailLevelChange}
              locale={props.locale}
              direction={props.direction}
              copy={props.copy}
              draft={props.draft}
              generation={props.generation}
              usage={props.usage}
              referenceImageUri={props.referenceImageUri}
              reducedMotion={reducedMotion}
              onSceneChange={props.onSceneChange}
              onCreate={() => startDoodle(props.onCreate)}
              onRetry={() => startDoodle(props.onRetry)}
              onSelectSuggestion={props.onSceneChange}
              onRefreshSuggestions={props.onRefreshSuggestions}
              onDownload={props.onDownload}
              onShare={props.onShare}
              onNewScene={props.onNewScene}
              onResultBack={props.onResultBack}
              onOpenMore={props.onOpenMore}
              onOpenLarger={props.onOpenLarger}
              gridEnabled={gridEnabled}
              onToggleGrid={() => setGridImageUri(current => props.generation.status === "ready" && current !== props.generation.imageUri ? props.generation.imageUri : null)}
            />
          ) : null}
          {props.tab === "ideas" ? <NativeIdeasView locale={props.locale} direction={props.direction} copy={props.copy} ideas={props.ideas} isGenerating={props.generation.status === "waiting"} onSelectIdea={props.onSelectIdea} reducedMotion={reducedMotion} /> : null}
          {props.tab === "settings" ? <NativeSettingsView locale={props.locale} direction={props.direction} copy={props.copy} locales={props.locales} supportLinks={props.supportLinks} onLocaleChange={props.onLocaleChange} onSupportLink={props.onSupportLink} onShareDiagnostics={props.onShareDiagnostics} /> : null}
        </View>
        <NativeBottomTabs locale={props.locale} direction={props.direction} copy={props.copy} tab={props.tab} onTabChange={props.onTabChange} />
      </View>

      <NativeMoreModal locale={props.locale} direction={props.direction} copy={props.copy} visible={props.modal === "more"} onClose={props.onCloseModal} onRedraw={() => startDoodle(props.onRedraw)} onOpenReport={props.onOpenReport} />
      <NativeReportModal locale={props.locale} direction={props.direction} copy={props.copy} visible={props.modal === "report"} reportState={props.reportState} onClose={props.onCloseModal} onSubmit={props.onReportSubmit} />
      <NativePurchaseModal locale={props.locale} direction={props.direction} copy={props.copy} purchase={props.modal === "purchase" ? props.purchase : undefined} onCancel={props.onCancelPurchase} onPurchase={props.onPurchase} onRestore={props.onRestore} onSignIn={props.onSignIn} onNewScene={props.onNewScene} />
      <NativeImageModal locale={props.locale} direction={props.direction} copy={props.copy} visible={props.modal === "image"} imageUri={readyImage} imageAlt={readyAlt} onClose={props.onCloseModal} onAction={props.onDownload} gridEnabled={props.generation.status === "ready" ? gridEnabled : undefined} onToggleGrid={props.generation.status === "ready" ? () => setGridImageUri(current => current === readyImage ? null : readyImage) : undefined} reducedMotion={reducedMotion} />
      <NativeAccountModal locale={props.locale} direction={props.direction} copy={props.copy} account={props.account} state={props.accountModal} onClose={props.onCloseAccount} onSignIn={props.onSignIn} onRefill={props.onRefill} onSignOut={props.onSignOut} onDeleteRequest={props.onDeleteRequest} onDeleteConfirm={props.onDeleteConfirm} />
    </SafeAreaView>
  );
}

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReducedMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}

const styles = StyleSheet.create({
  safe: { backgroundColor: NATIVE_COLORS.canvas, flex: 1 },
  root: { flex: 1 },
  accountHeader: { alignItems: "flex-end", minHeight: 58, paddingHorizontal: NATIVE_SPACING.screen, paddingTop: 6 },
  content: { flex: 1 },
});
