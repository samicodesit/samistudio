import { Image } from "expo-image";
import { useRef, useState } from "react";
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { DETAIL_LEVELS, type DetailLevel } from "../../../src/lib/generation/detail-level";
import { getDetailLevelCopy } from "../../../src/lib/detail-level-copy";
import { NativeModalFrame } from "./NativeModals";
import { NATIVE_COLORS, nativeFontFamily, nativeRowDirection, nativeTextAlign } from "./theme";
import { NativeIcon } from "./NativeIcon";
import type { NativeDirection, NativeLocale } from "./types";

const EXAMPLES: Record<DetailLevel, number> = {
  simple: require("../../assets/detail/dog-simple.webp"),
  medium: require("../../assets/detail/dog-medium.webp"),
  detailed: require("../../assets/detail/dog-detailed.webp"),
};
export function NativeDetailSelector({ locale, direction, value, disabled, onChange, onFocusVisible }: {
  locale: NativeLocale; direction: NativeDirection; value: DetailLevel;
  disabled: boolean; reducedMotion: boolean; onChange(level: DetailLevel): void; onFocusVisible(tile: View): void;
}) {
  const copy = getDetailLevelCopy(locale);
  const [expanded, setExpanded] = useState(false);
  const [focused, setFocused] = useState(false);
  const trigger = useRef<View>(null);
  const { width, fontScale } = useWindowDimensions();
  const largeText = fontScale > 1.3;
  const controlWidth = largeText ? Math.min(280, width - 36) : Math.min(190, Math.max(150, width * .4));
  const body = { fontFamily: nativeFontFamily(locale,"body"), textAlign: nativeTextAlign(direction) };
  return <View style={[styles.group, { width: controlWidth, maxWidth: largeText ? "100%" : "57%" }]}>
    <Pressable testID="detail-trigger" ref={trigger} accessibilityRole="button" accessibilityLabel={`${copy.heading}: ${copy.levels[value]}`} accessibilityState={{ expanded, disabled }} disabled={disabled}
      onPress={() => {Keyboard.dismiss();setExpanded(true);}} onFocus={() => {setFocused(true);if(trigger.current)onFocusVisible(trigger.current);}} onBlur={() => setFocused(false)}
      style={({pressed}) => [styles.trigger,{flexDirection:nativeRowDirection(direction)},focused && styles.focused,disabled && styles.disabled,pressed && styles.pressed]}>
      <Image source={EXAMPLES[value]} cachePolicy="memory" contentFit="cover" accessible={false} style={styles.thumbnail} />
      <View style={styles.label}><Text style={[styles.caption,body]}>{copy.heading}</Text><Text style={[styles.value,body]}>{copy.levels[value]}</Text></View>
      <NativeIcon name="chevronDown" size={14} color={NATIVE_COLORS.moss} />
    </Pressable>
    <NativeModalFrame titleMaxFontSizeMultiplier={2} contentKey={`detail:${value}`} visible={expanded && !disabled} title={copy.title} closeLabel={copy.close} locale={locale} direction={direction} onClose={() => setExpanded(false)}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.description,body]}>{copy.description}</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel={copy.label} style={[styles.options,{flexDirection:largeText ? "column" : nativeRowDirection(direction)}]}>
          {DETAIL_LEVELS.map(level => <Pressable testID={`detail-choice-${level}`} key={level} accessibilityRole="radio" accessibilityLabel={copy.levels[level]} accessibilityHint={copy.descriptions[level]} accessibilityState={{checked:value===level}}
            onPress={() => {onChange(level);setExpanded(false);}}
            style={({pressed}) => [styles.choice,largeText && styles.largeChoice,{flexDirection:largeText ? nativeRowDirection(direction) : "column"},value===level && styles.selected,pressed && styles.pressed]}>
            <Image source={EXAMPLES[level]} cachePolicy="memory" accessible={false} contentFit="cover" style={[styles.example,largeText && {width:Math.min(100,width*.25),aspectRatio:1}]} />
            <View style={styles.choiceCopy}><Text style={[styles.level,body]}>{copy.levels[level]}</Text><Text style={[styles.summary,body]}>{copy.descriptions[level]}</Text></View>
            {value===level ? <View pointerEvents="none" style={[styles.check,direction==="rtl" ? {left:10} : {right:10}]}><NativeIcon name="check" size={13} color={NATIVE_COLORS.paper} /></View> : null}
          </Pressable>)}
        </View>
      </ScrollView>
    </NativeModalFrame>
  </View>;
}
const styles=StyleSheet.create({
  group:{flexShrink:1}, trigger:{alignItems:"center",gap:8,minHeight:48,minWidth:132,padding:4,paddingEnd:9,borderWidth:1,borderColor:"#bbc6b5",borderRadius:12,backgroundColor:"#f9faf4"},
  thumbnail:{width:38,height:38,borderRadius:8},label:{flex:1,flexShrink:1},caption:{fontSize:10,color:"#64705f",marginBottom:3},value:{fontSize:13,fontWeight:"600",color:"#315747"},
  focused:{outlineColor:NATIVE_COLORS.moss,outlineWidth:2,outlineOffset:2},disabled:{opacity:.65},pressed:{opacity:.75},
  scroll:{flexShrink:1},content:{paddingBottom:8},description:{fontSize:14,lineHeight:21,color:"#64705f",marginTop:2,marginBottom:18},options:{gap:8,alignItems:"stretch"},
  choice:{flex:1,minWidth:0,padding:5,paddingBottom:11,borderWidth:1,borderColor:"#dce1d5",borderRadius:12,position:"relative"},largeChoice:{flex:0,alignItems:"center",gap:12},
  selected:{borderColor:"#487c65",backgroundColor:"#f0f5eb"},example:{width:"100%",aspectRatio:1,borderRadius:8,marginBottom:10},choiceCopy:{flexShrink:1},
  level:{paddingHorizontal:3,fontSize:14,fontWeight:"600",color:NATIVE_COLORS.graphite},summary:{paddingHorizontal:3,fontSize:11,lineHeight:16,color:"#64705f",marginTop:3},
  check:{position:"absolute",top:10,width:20,height:20,borderRadius:10,backgroundColor:NATIVE_COLORS.moss,alignItems:"center",justifyContent:"center"},
});
