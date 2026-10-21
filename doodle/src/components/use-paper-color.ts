"use client";
import { useCallback, useState, useSyncExternalStore } from "react";
import { PAPER_COLOR_STORAGE_KEY, storedPaperColor, type PaperColorId } from "@/lib/generation/paper-colors";
function subscribe(callback:()=>void) { window.addEventListener("storage",callback);window.addEventListener("doodle-paper-color",callback);return ()=>{window.removeEventListener("storage",callback);window.removeEventListener("doodle-paper-color",callback);}; }
function read() { try{return storedPaperColor(localStorage.getItem(PAPER_COLOR_STORAGE_KEY));}catch{return "yellow" as const;} }
const hydrate=()=>()=>undefined;
export function usePaperColor() {
 const restored=useSyncExternalStore(subscribe,read,()=>"yellow" as PaperColorId);
 const paperReady=useSyncExternalStore(hydrate,()=>true,()=>false);
 const [fallback,setFallback]=useState<PaperColorId>();
 const selectPaperColor=useCallback((color:PaperColorId)=>{
  try{localStorage.setItem(PAPER_COLOR_STORAGE_KEY,color);setFallback(undefined);window.dispatchEvent(new Event("doodle-paper-color"));}catch{setFallback(color);}
 },[]);
 return {paperColor:fallback??restored,paperReady,selectPaperColor};
}
