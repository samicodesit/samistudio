"use client";
import { useCallback, useEffect, useId, useRef } from "react";
import { PAPER_COLORS, type PaperColorId } from "@/lib/generation/paper-colors";
import { getPaperColorCopy } from "@/lib/paper-color-copy";
export function PaperColorSelector({ value, onChange, disabled = false, locale }: { value: PaperColorId; onChange(value: PaperColorId): void; disabled?: boolean; locale: string }) {
 const name=useId(), copy=getPaperColorCopy(locale);
 const strip=useRef<HTMLDivElement>(null);
 const reveal=useCallback((focused?: HTMLInputElement) => {
  const row=strip.current, selected=focused ?? row?.querySelector<HTMLInputElement>("input:checked");
  if(!row || !selected)return;
  const bounds=row.getBoundingClientRect(), dot=selected.getBoundingClientRect();
  const delta=dot.left<bounds.left ? dot.left-bounds.left : dot.right>bounds.right ? dot.right-bounds.right : 0;
  if(delta)row.scrollBy?.({left:delta,behavior:"auto"});
 },[]);
 useEffect(reveal,[reveal,value,locale]);
 return <div ref={strip} className="paper-color-scroll" role="group" aria-label={copy.label}>
  <div className="paper-color-track"><span className="paper-color-label" aria-hidden="true">{copy.heading}</span>
   {PAPER_COLORS.map(color=><label className="paper-color-option" key={color.id}>
    <input type="radio" name={name} value={color.id} checked={value===color.id} disabled={disabled} aria-label={copy.colors[color.id]} onChange={()=>onChange(color.id)} onFocus={event=>reveal(event.currentTarget)}/>
    <span className="paper-color-dot" style={{backgroundColor:color.hex}} aria-hidden="true">{value===color.id ? "✓" : ""}</span>
   </label>)}
  </div>
 </div>;
}
