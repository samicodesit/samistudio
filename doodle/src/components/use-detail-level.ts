"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { DETAIL_STORAGE_KEY, storedDetailLevel, type DetailLevel } from "@/lib/generation/detail-level";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}
function readPreference(): DetailLevel {
  try { return storedDetailLevel(window.localStorage.getItem(DETAIL_STORAGE_KEY)); } catch { return "simple"; }
}
const subscribeHydration = () => () => undefined;

export function useDetailLevel(initialDetailLevel?: DetailLevel) {
  const restored = useSyncExternalStore(subscribe, readPreference, () => "simple" as DetailLevel);
  const detailReady = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const [selected, setSelected] = useState<DetailLevel | undefined>();
  const selectDetailLevel = useCallback((level: DetailLevel) => {
    if (!detailReady) return;
    setSelected(level);
    try { window.localStorage.setItem(DETAIL_STORAGE_KEY, level); } catch {}
  }, [detailReady]);
  return { detailLevel: selected ?? initialDetailLevel ?? restored, detailReady, selectDetailLevel };
}
