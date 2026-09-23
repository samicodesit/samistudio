import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeIcon } from "./NativeIcon";
import { NATIVE_COLORS, NATIVE_SPACING, nativeFontFamily, nativeRowDirection, nativeTextAlign } from "./theme";
import type { NativeDirection, NativeDoodleUiCopy, NativeLocale, NativeLocaleOption, NativeSupportLink } from "./types";

interface NativeSettingsViewProps {
  locale: NativeLocale;
  direction: NativeDirection;
  copy: NativeDoodleUiCopy;
  locales: readonly NativeLocaleOption[];
  supportLinks: readonly NativeSupportLink[];
  onLocaleChange(locale: NativeLocale): void;
  onSupportLink(id: NativeSupportLink["id"]): void;
}

export function NativeSettingsView({ locale, direction, copy, locales, supportLinks, onLocaleChange, onSupportLink }: NativeSettingsViewProps) {
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text accessibilityRole="header" style={[styles.title, { fontFamily: nativeFontFamily(locale, "display"), textAlign: nativeTextAlign(direction) }]}>
        {copy.settings.title}
      </Text>
      <View style={styles.section}>
        <View style={[styles.sectionHeading, { flexDirection: nativeRowDirection(direction) }]}>
          <NativeIcon name="language" size={21} color={NATIVE_COLORS.moss} />
          <Text accessibilityRole="header" style={[styles.sectionTitle, { fontFamily: nativeFontFamily(locale, "body"), textAlign: nativeTextAlign(direction) }]}>
            {copy.header.languageLabel}
          </Text>
        </View>
        <View style={styles.languageList}>
          {locales.map((item) => {
            const selected = item.value === locale;
            return (
              <Pressable
                key={item.value}
                accessibilityRole="radio"
                accessibilityLabel={item.label}
                accessibilityState={{ selected }}
                onPress={() => onLocaleChange(item.value)}
                style={({ pressed }) => [styles.languageRow, { flexDirection: nativeRowDirection(direction) }, selected && styles.languageSelected, pressed && styles.pressed]}
              >
                <Text style={[styles.languageLabel, { fontFamily: nativeFontFamily(item.value, "body"), textAlign: nativeTextAlign(direction) }]}>{item.label}</Text>
                {selected ? <NativeIcon name="check" size={20} color={NATIVE_COLORS.moss} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={[styles.sectionTitle, { fontFamily: nativeFontFamily(locale, "body"), textAlign: nativeTextAlign(direction) }]}>
          {copy.settings.supportTitle}
        </Text>
        <View style={styles.supportList}>
          {supportLinks.map((link) => (
            <Pressable
              key={link.id}
              accessibilityRole="button"
              accessibilityLabel={link.label}
              onPress={() => onSupportLink(link.id)}
              style={({ pressed }) => [styles.supportRow, { flexDirection: nativeRowDirection(direction) }, pressed && styles.pressed]}
            >
              <Text style={[styles.supportText, { fontFamily: nativeFontFamily(locale, "body"), textAlign: nativeTextAlign(direction) }]}>{link.label}</Text>
              <NativeIcon name="chevronForward" size={18} color={NATIVE_COLORS.muted} />
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: 26, paddingBottom: 24, paddingHorizontal: NATIVE_SPACING.screen, paddingTop: 18 },
  title: { color: NATIVE_COLORS.graphite, fontSize: 36, fontWeight: "600", lineHeight: 40 },
  section: { gap: 12 },
  sectionHeading: { alignItems: "center", gap: 8 },
  sectionTitle: { color: NATIVE_COLORS.graphite, fontSize: 18, fontWeight: "700", lineHeight: 24 },
  languageList: { backgroundColor: NATIVE_COLORS.paper, borderColor: NATIVE_COLORS.softLine, borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  languageRow: { alignItems: "center", justifyContent: "space-between", minHeight: NATIVE_SPACING.control, paddingHorizontal: 16 },
  languageSelected: { backgroundColor: NATIVE_COLORS.selected },
  languageLabel: { color: NATIVE_COLORS.graphite, flex: 1, fontSize: 15, lineHeight: 21 },
  supportList: { backgroundColor: NATIVE_COLORS.paper, borderColor: NATIVE_COLORS.softLine, borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  supportRow: { alignItems: "center", borderBottomColor: NATIVE_COLORS.softLine, borderBottomWidth: StyleSheet.hairlineWidth, justifyContent: "space-between", minHeight: NATIVE_SPACING.control, paddingHorizontal: 16 },
  supportText: { color: NATIVE_COLORS.moss, flex: 1, fontSize: 15, fontWeight: "600", lineHeight: 21 },
  pressed: { opacity: 0.72 },
});
