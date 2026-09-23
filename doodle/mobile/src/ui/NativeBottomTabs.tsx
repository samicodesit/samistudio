import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeIcon, type NativeIconName } from "./NativeIcon";
import { NATIVE_COLORS, nativeFontFamily, nativeRowDirection } from "./theme";
import type { NativeDirection, NativeDoodleUiCopy, NativeLocale, NativeTab } from "./types";

interface NativeBottomTabsProps {
  locale: NativeLocale;
  direction: NativeDirection;
  copy: NativeDoodleUiCopy;
  tab: NativeTab;
  onTabChange(tab: NativeTab): void;
}

const TAB_ICONS: { [key in NativeTab]: NativeIconName } = {
  create: "create",
  ideas: "ideas",
  settings: "settings",
};

export function NativeBottomTabs({ locale, direction, copy, tab, onTabChange }: NativeBottomTabsProps) {
  const insets = useSafeAreaInsets();
  const items: readonly { id: NativeTab; label: string }[] = [
    { id: "create", label: copy.navigation.create },
    { id: "ideas", label: copy.navigation.ideas },
    { id: "settings", label: copy.navigation.settings },
  ];

  return (
    <View
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}
      accessibilityRole="tablist"
      accessibilityLabel={copy.navigation.appLabel}
    >
      <View style={[styles.items, { flexDirection: nativeRowDirection(direction) }]}>
        {items.map((item) => {
          const selected = item.id === tab;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected }}
              onPress={() => onTabChange(item.id)}
              style={({ pressed }) => [styles.item, selected && styles.itemSelected, pressed && styles.itemPressed]}
            >
              <NativeIcon name={TAB_ICONS[item.id]} size={21} color={selected ? NATIVE_COLORS.moss : NATIVE_COLORS.muted} />
              <Text style={[styles.label, { color: selected ? NATIVE_COLORS.moss : NATIVE_COLORS.muted, fontFamily: nativeFontFamily(locale, "body") }]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: NATIVE_COLORS.paper,
    borderTopColor: NATIVE_COLORS.softLine,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  items: { gap: 8 },
  item: {
    alignItems: "center",
    borderRadius: 12,
    flex: 1,
    gap: 3,
    justifyContent: "center",
    minHeight: 48,
  },
  itemSelected: { backgroundColor: NATIVE_COLORS.selected },
  itemPressed: { opacity: 0.72 },
  label: { fontSize: 12, fontWeight: "600", lineHeight: 16 },
});
