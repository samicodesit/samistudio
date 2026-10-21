import { useCallback, useEffect, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { PAPER_COLORS, type PaperColorId } from "@web/lib/generation/paper-colors";
import { getPaperColorCopy } from "@web/lib/paper-color-copy";
import type { NativeLocale } from "./types";
import { NATIVE_SPACING, nativeFontFamily } from "./theme";
export function NativePaperColorSelector({ value, onChange, disabled=false, locale, direction }: {value:PaperColorId;onChange(value:PaperColorId):void;disabled?:boolean;locale:NativeLocale;direction:"ltr"|"rtl"}) {
 const copy=getPaperColorCopy(locale);
 const scroll=useRef<ScrollView>(null), viewport=useRef(0), offset=useRef(0), positions=useRef<Partial<Record<PaperColorId,number>>>({});
 const reveal=useCallback(() => {
  const x=positions.current[value], width=viewport.current;
  if(x===undefined || !width)return;
  const next=x<offset.current ? x : x+48>offset.current+width ? x+48-width : offset.current;
  if(next!==offset.current){offset.current=next;scroll.current?.scrollTo({x:next,animated:false});}
 },[value]);
 useEffect(reveal,[reveal,direction]);
 return <View style={styles.edge}><ScrollView ref={scroll} onLayout={event=>{viewport.current=event.nativeEvent.layout.width;reveal();}} onScroll={event=>{offset.current=event.nativeEvent.contentOffset.x;}} scrollEventThrottle={16} onContentSizeChange={reveal} horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" alwaysBounceHorizontal={false} contentContainerStyle={[styles.track,{flexDirection:direction==="rtl"?"row-reverse":"row"}]}>
  <Text style={[styles.label,{fontFamily:nativeFontFamily(locale,"body")}]}>{copy.heading}</Text>
  {PAPER_COLORS.map(color=><Pressable onLayout={event=>{positions.current[color.id]=event.nativeEvent.layout.x;if(color.id===value)reveal();}} key={color.id} accessibilityRole="radio" accessibilityLabel={copy.colors[color.id]} accessibilityState={{checked:value===color.id,disabled}} disabled={disabled} onPress={()=>onChange(color.id)} style={[styles.target,disabled&&styles.disabled]}>
   <View style={[styles.ring,value===color.id&&styles.selected]}><View style={[styles.dot,{backgroundColor:color.hex}]}><Text allowFontScaling={false} accessible={false} style={styles.check}>{value===color.id?"✓":""}</Text></View></View>
  </Pressable>)}
 </ScrollView></View>;
}
const styles=StyleSheet.create({
 edge:{marginHorizontal:-NATIVE_SPACING.screen,marginTop:-20,marginBottom:-20,paddingVertical:4},
 track:{alignItems:"center",paddingHorizontal:NATIVE_SPACING.screen},
 label:{fontSize:13,color:"#5c5c5c",marginEnd:8},
 target:{width:48,height:48,alignItems:"center",justifyContent:"center"},
 ring:{width:32,height:32,borderRadius:16,alignItems:"center",justifyContent:"center",borderWidth:1.5,borderColor:"transparent"},
 selected:{borderColor:"#20231f"},dot:{width:24,height:24,borderRadius:12,borderWidth:1,borderColor:"#20231f26",alignItems:"center",justifyContent:"center"},
 check:{fontSize:15,fontWeight:"600",color:"#20231f",lineHeight:20},disabled:{opacity:.55},
});
