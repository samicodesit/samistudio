import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { PlayPackId } from "../contracts/native";
import { getNativePackCopy } from "../services/pack-copy";
import { getNativeCopy } from "../services/localization";
import { NativeSignInChoices } from "./NativeSignInChoices";
import { nativeFontFamily, nativeRowDirection, nativeTextAlign } from "./theme";
import type { NativeDirection, NativeLocale, NativePurchaseUi } from "./types";

interface Props {
  locale: NativeLocale; direction: NativeDirection; purchase?: NativePurchaseUi;
  reducedMotion: boolean; pendingProvider?: "google" | "apple";
  onCancel(): void; onPurchase(): void; onSelectPack(productId: PlayPackId): void;
  onSignIn?(): void; onAppleSignIn?(): void;
}

/** Opaque purchase surface. Drawing and prompt stay mounted underneath. */
export function NativePackPaywall({ locale, direction, purchase, reducedMotion, pendingProvider, onCancel, onPurchase, onSelectPack, onSignIn, onAppleSignIn }: Props) {
  const copy = getNativePackCopy(locale);
  const signIn = purchase?.mode === "signIn";
  const font = { fontFamily: nativeFontFamily(locale, "body"), textAlign: nativeTextAlign(direction) };
  const display = { fontFamily: nativeFontFamily(locale, "display"), textAlign: nativeTextAlign(direction) };
  const row = { flexDirection: nativeRowDirection(direction) };
  const busy = !!purchase?.busy;
  const processing = purchase?.mode === "pending" || (busy && purchase?.mode === "checkout");
  const blocked = busy && purchase?.mode === "checkout";
  const ready = !!purchase?.packs?.length;
  const buyLabel = processing ? copy.processing : ready ? purchase?.buyLabel || copy.getMore : busy ? copy.loading : getNativeCopy(locale).actions.tryAgain;
  return (
    <Modal visible={!!purchase?.visible} transparent={false} animationType={reducedMotion ? "none" : "slide"} onRequestClose={() => { if (!blocked) onCancel(); }} statusBarTranslucent navigationBarTranslucent>
      <SafeAreaView edges={["top", "bottom"]} style={styles.surface}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
          <View style={styles.handle} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
          <View style={styles.header}>
            <Text accessibilityRole="header" style={[styles.title, display]}>{signIn ? getNativeCopy(locale).auth.signIn : purchase?.title || copy.title}</Text>
            <Text style={[styles.body, font]}>{purchase?.body || copy.terms}</Text>
          </View>
          {!ready ? <View style={styles.unavailable}><ActivityIndicator color="#195C47" animating={busy} /><Text accessibilityLiveRegion="polite" style={[styles.body, font]}>{busy ? copy.loading : copy.unavailable}</Text></View> : null}
          {!signIn ? <View accessibilityRole="radiogroup" style={styles.packs}>
            {purchase?.packs?.map(pack => (
              <Pressable key={pack.productId} accessibilityRole="radio" accessibilityLabel={[pack.name, pack.quantityLabel, pack.priceLabel, pack.unitPriceLabel, pack.caption, pack.badge, pack.offerLabel].filter(Boolean).join(". ")} accessibilityState={{ checked: pack.selected, disabled: busy }} disabled={busy} onPress={() => onSelectPack(pack.productId)} style={({ pressed }) => [styles.pack, pack.productId === "pack_regular" && styles.regular, pack.selected && styles.selected, pressed && !busy && styles.pressed]}>
                <View style={[styles.first, row]}>
                  <View style={[styles.nameGroup, row]}>
                    <View style={[styles.radio, pack.selected && styles.selectedRadio]}>{pack.selected ? <View style={styles.radioDot} /> : null}</View>
                    <Text style={[styles.name, font, pack.selected && styles.light]}>{pack.name}</Text>
                    {pack.badge ? <View style={[styles.badge, pack.selected && styles.selectedBadge]}><Text style={[styles.badgeText, font]}>{pack.badge}</Text></View> : null}
                  </View>
                  <Text style={[styles.price, font, pack.selected && styles.light]}>{pack.priceLabel}</Text>
                </View>
                <View style={[styles.quantityRow, row]}>
                  <Text style={[styles.quantity, display, pack.selected && styles.light]}>{pack.quantityLabel}</Text>
                  <Text style={[styles.secondary, font, pack.selected && styles.lightSecondary]}>{pack.unitPriceLabel}</Text>
                </View>
                <Text style={[styles.caption, font, pack.selected && styles.lightSecondary]}>{pack.caption}</Text>
                {pack.offerLabel ? <Text style={[styles.offer, font, pack.selected && styles.selectedOffer]}>{pack.offerLabel}</Text> : null}
              </Pressable>
            ))}
          </View> : null}
        </ScrollView>
        <View style={styles.footer}>
          {ready && purchase?.errorLabel ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.error, font]}>{purchase.errorLabel}</Text> : null}
          <Text style={[styles.reassurance, font, { textAlign: "center" }]}>{copy.neverExpire}{"\n"}{copy.failedFree}</Text>
          {signIn ? <NativeSignInChoices locale={locale} copy={getNativeCopy(locale)} busy={busy} pendingProvider={pendingProvider} onGoogle={onSignIn ?? onPurchase} onApple={onAppleSignIn} /> : <Pressable accessibilityRole="button" accessibilityLabel={buyLabel} accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={onPurchase} style={({ pressed }) => [styles.buy, busy && styles.disabled, pressed && !busy && styles.pressed]}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : null}
            <Text style={[styles.buyText, { fontFamily: nativeFontFamily(locale, "body") }]}>{buyLabel}</Text>
          </Pressable>}
          <Pressable accessibilityRole="button" accessibilityLabel={copy.notNow} accessibilityState={{ disabled: blocked }} disabled={blocked} onPress={onCancel} style={({ pressed }) => [styles.notNow, pressed && !blocked && styles.pressed]}>
            <Text style={[styles.notNowText, font]}>{copy.notNow}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  surface: { flex: 1, backgroundColor: "#FCFCF8" },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 12 },
  handle: { height: 4, width: 34, borderRadius: 2, backgroundColor: "#C8CCC5", alignSelf: "center", marginBottom: 24 },
  header: { gap: 10, marginBottom: 24 },
  title: { fontSize: 34, lineHeight: 40, fontWeight: "700", color: "#20231F" },
  body: { fontSize: 14, lineHeight: 21, color: "#5C5C5C" },
  packs: { gap: 12 },
  pack: { backgroundColor: "#FFFFFF", borderColor: "#D5DAD0", borderWidth: 1, borderRadius: 14, padding: 15, gap: 6 },
  regular: { paddingVertical: 18 },
  selected: { backgroundColor: "#195C47", borderColor: "#195C47" },
  first: { alignItems: "center", justifyContent: "space-between", gap: 12 },
  nameGroup: { alignItems: "center", gap: 8, flex: 1, flexWrap: "wrap" },
  name: { fontSize: 16, lineHeight: 22, fontWeight: "600", color: "#20231F" },
  price: { fontSize: 17, lineHeight: 24, fontWeight: "600", color: "#20231F", flexShrink: 0 },
  radio: { height: 18, width: 18, borderWidth: 1.5, borderColor: "#838D7E", borderRadius: 9, alignItems: "center", justifyContent: "center" },
  selectedRadio: { borderColor: "#FFFFFF" },
  radioDot: { height: 8, width: 8, borderRadius: 4, backgroundColor: "#FFFFFF" },
  badge: { backgroundColor: "#E5EEE6", borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
  selectedBadge: { backgroundColor: "#FFEB8A" },
  badgeText: { color: "#20231F", fontSize: 14, lineHeight: 18, fontWeight: "600" },
  quantityRow: { gap: 10, alignItems: "baseline", flexWrap: "wrap" },
  quantity: { fontSize: 22, lineHeight: 28, fontWeight: "700", color: "#20231F" },
  secondary: { fontSize: 14, lineHeight: 20, color: "#5C5C5C" },
  caption: { fontSize: 14, lineHeight: 20, color: "#5C5C5C" },
  light: { color: "#FFFFFF" },
  lightSecondary: { color: "#E0EBE0" },
  offer: { fontSize: 14, lineHeight: 21, color: "#195C47", marginTop: 6, borderTopWidth: 1, borderTopColor: "#CAD8CB", paddingTop: 12 },
  selectedOffer: { color: "#FFEB8A", borderTopColor: "#598771" },
  footer: { backgroundColor: "#FCFCF8", paddingHorizontal: 22, paddingTop: 12, paddingBottom: 4, gap: 12 },
  reassurance: { color: "#5C5C5C", fontSize: 14, lineHeight: 21, textAlign: "center" },
  buy: { backgroundColor: "#195C47", borderRadius: 12, minHeight: 52, padding: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 },
  buyText: { color: "#FFFFFF", fontSize: 16, lineHeight: 22, fontWeight: "600", textAlign: "center" },
  notNow: { minHeight: 48, padding: 10, justifyContent: "center", alignItems: "center" },
  notNowText: { color: "#5C5C5C", fontSize: 14, lineHeight: 20 },
  unavailable: { paddingVertical: 28, gap: 16, alignItems: "center" },
  error: { color: "#924137", fontSize: 14, lineHeight: 21 },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.65 },
});
