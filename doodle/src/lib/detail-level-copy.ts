import type { DetailLevel } from "./generation/detail-level";
type BaseDetailCopy = { heading: string; label: string; show: string; hide: string; levels: Record<DetailLevel, string> };
const COPY: Record<string, BaseDetailCopy> = {
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
type PickerCopy = { title: string; description: string; close: string; descriptions: Record<DetailLevel, string> };
const PICKER_COPY: Record<string, PickerCopy> = {
 en: { title:"Drawing detail", description:"More detail means more lines to draw.", close:"Close detail choices", descriptions:{simple:"Few lines",medium:"Extra features",detailed:"Finer details"} },
 nl: { title:"Detail van je tekening", description:"Meer detail betekent meer lijnen om te tekenen.", close:"Detailkeuzes sluiten", descriptions:{simple:"Weinig lijnen",medium:"Extra kenmerken",detailed:"Fijne details"} },
 de: { title:"Zeichendetails", description:"Mehr Details bedeuten mehr Linien zum Zeichnen.", close:"Detailauswahl schließen", descriptions:{simple:"Wenige Linien",medium:"Mehr Merkmale",detailed:"Feine Details"} },
 fr: { title:"Détail du dessin", description:"Plus de détails, c’est plus de lignes à dessiner.", close:"Fermer les choix de détail", descriptions:{simple:"Peu de lignes",medium:"Plus d’éléments",detailed:"Détails fins"} },
 es: { title:"Detalle del dibujo", description:"Más detalle significa más líneas que dibujar.", close:"Cerrar opciones de detalle", descriptions:{simple:"Pocas líneas",medium:"Más elementos",detailed:"Detalles finos"} },
 "pt-br": { title:"Detalhe do desenho", description:"Mais detalhes significam mais linhas para desenhar.", close:"Fechar opções de detalhe", descriptions:{simple:"Poucas linhas",medium:"Mais elementos",detailed:"Detalhes finos"} },
 it: { title:"Dettaglio del disegno", description:"Più dettagli significano più linee da disegnare.", close:"Chiudi le opzioni di dettaglio", descriptions:{simple:"Poche linee",medium:"Più elementi",detailed:"Dettagli fini"} },
 ja: { title:"描き込みの細かさ", description:"細かいほど、描く線が多くなります。", close:"細かさの選択を閉じる", descriptions:{simple:"少ない線",medium:"少し描き込む",detailed:"細部まで描く"} },
 ko: { title:"그림 디테일", description:"디테일이 많을수록 그릴 선이 많아져요.", close:"디테일 선택 닫기", descriptions:{simple:"적은 선",medium:"추가 요소",detailed:"섬세한 디테일"} },
 ar: { title:"تفاصيل الرسم", description:"تفاصيل أكثر تعني خطوطًا أكثر للرسم.", close:"إغلاق خيارات التفاصيل", descriptions:{simple:"خطوط قليلة",medium:"ملامح إضافية",detailed:"تفاصيل دقيقة"} },
};
export function getDetailLevelCopy(locale: string): BaseDetailCopy & PickerCopy { return { ...(COPY[locale] ?? COPY.en), ...(PICKER_COPY[locale] ?? PICKER_COPY.en) }; }
