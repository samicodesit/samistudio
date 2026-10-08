import type { Locale } from "./i18n";

export const GRID_POSITIONS = [25, 50, 75] as const;
export const GRID_FADE_MS = 180;
export const GRID_LINE_COLOR = "rgba(38, 103, 139, 0.85)";

export const GRID_COPY: Record<Locale, { show: string; hide: string }> = {
  en: { show: "Show grid", hide: "Hide grid" },
  nl: { show: "Raster tonen", hide: "Raster verbergen" },
  de: { show: "Raster anzeigen", hide: "Raster ausblenden" },
  fr: { show: "Afficher la grille", hide: "Masquer la grille" },
  es: { show: "Mostrar cuadrícula", hide: "Ocultar cuadrícula" },
  "pt-br": { show: "Mostrar grade", hide: "Ocultar grade" },
  it: { show: "Mostra griglia", hide: "Nascondi griglia" },
  ja: { show: "グリッドを表示", hide: "グリッドを非表示" },
  ko: { show: "격자 표시", hide: "격자 숨기기" },
  ar: { show: "إظهار الشبكة", hide: "إخفاء الشبكة" },
};
