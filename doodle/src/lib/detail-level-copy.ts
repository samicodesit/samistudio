import type { DetailLevel } from "./generation/detail-level";
type DetailCopy = { heading: string; label: string; show: string; hide: string; levels: Record<DetailLevel, string> };
const COPY: Record<string, DetailCopy> = {
  en: { heading: "Detail", label: "Detail level", show: "Show detail levels", hide: "Hide detail levels", levels: { simple: "Simple", medium: "Medium", detailed: "Detailed" } },
  nl: { heading: "Detail", label: "Detailniveau", show: "Detailniveaus tonen", hide: "Detailniveaus verbergen", levels: { simple: "Eenvoudig", medium: "Gemiddeld", detailed: "Gedetailleerd" } },
  de: { heading: "Details", label: "Detailgrad", show: "Detailstufen anzeigen", hide: "Detailstufen ausblenden", levels: { simple: "Einfach", medium: "Mittel", detailed: "Detailliert" } },
  fr: { heading: "Détail", label: "Niveau de détail", show: "Afficher les niveaux de détail", hide: "Masquer les niveaux de détail", levels: { simple: "Simple", medium: "Moyen", detailed: "Détaillé" } },
  es: { heading: "Detalle", label: "Nivel de detalle", show: "Mostrar niveles de detalle", hide: "Ocultar niveles de detalle", levels: { simple: "Simple", medium: "Medio", detailed: "Detallado" } },
  "pt-br": { heading: "Detalhe", label: "Nível de detalhe", show: "Mostrar níveis de detalhe", hide: "Ocultar níveis de detalhe", levels: { simple: "Simples", medium: "Médio", detailed: "Detalhado" } },
  it: { heading: "Dettaglio", label: "Livello di dettaglio", show: "Mostra livelli di dettaglio", hide: "Nascondi livelli di dettaglio", levels: { simple: "Semplice", medium: "Medio", detailed: "Dettagliato" } },
  ja: { heading: "細かさ", label: "描き込みの細かさ", show: "細かさの選択を表示", hide: "細かさの選択を隠す", levels: { simple: "シンプル", medium: "ふつう", detailed: "細かい" } },
  ko: { heading: "디테일", label: "디테일 수준", show: "디테일 수준 표시", hide: "디테일 수준 숨기기", levels: { simple: "간단하게", medium: "보통", detailed: "세밀하게" } },
  ar: { heading: "التفاصيل", label: "مستوى التفاصيل", show: "إظهار مستويات التفاصيل", hide: "إخفاء مستويات التفاصيل", levels: { simple: "بسيط", medium: "متوسط", detailed: "مفصل" } },
};
export function getDetailLevelCopy(locale: string): DetailCopy { return COPY[locale] ?? COPY.en; }
