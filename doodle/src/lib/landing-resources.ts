import type { Locale } from "./i18n";

const LABELS: Record<Locale, readonly [string, string, string, string, string, string]> = {
  en: ["Make a doodle of your own.", "Try Doodle", "Explore drawing ideas", "Card doodles", "Lunchbox notes", "Journal doodles"],
  nl: ["Maak je eigen doodle.", "Probeer Doodle", "Ontdek tekenideeën", "Doodles voor kaarten", "Broodtrommelbriefjes", "Doodles voor je dagboek"],
  de: ["Mach dein eigenes Doodle.", "Doodle ausprobieren", "Zeichenideen entdecken", "Doodles für Karten", "Brotdosen-Zettel", "Doodles fürs Tagebuch"],
  fr: ["Créez votre propre dessin.", "Essayer Doodle", "Explorer les idées de dessins", "Dessins pour les cartes", "Petits mots du déjeuner", "Dessins pour le journal"],
  es: ["Crea tu propio dibujo.", "Prueba Doodle", "Explora ideas de dibujos", "Dibujos para tarjetas", "Notas del almuerzo", "Dibujos para el diario"],
  "pt-br": ["Crie seu próprio desenho.", "Experimente o Doodle", "Explore ideias de desenhos", "Desenhos para cartões", "Bilhetes na lancheira", "Desenhos para o diário"],
  it: ["Crea il tuo disegno.", "Prova Doodle", "Esplora idee per disegni", "Disegni per biglietti", "Biglietti nel portapranzo", "Disegni per il diario"],
  ja: ["自分だけのイラストを作ろう。", "Doodleを試す", "イラストのアイデアを見る", "カードのイラスト", "お弁当のメモ", "日記のイラスト"],
  ko: ["나만의 그림을 만들어 보세요.", "Doodle 사용해 보기", "그림 아이디어 둘러보기", "카드 그림", "도시락 메모", "일기 그림"],
  ar: ["أنشئ رسمتك الخاصة.", "جرّب Doodle", "استكشف أفكار الرسم", "رسومات للبطاقات", "ملاحظات الغداء", "رسومات لليوميات"],
};

export function getLandingResources(locale: Locale) {
  const [title, tryDoodle, exploreIdeas, ...guides] = LABELS[locale];
  return { title, tryDoodle, exploreIdeas, guides };
}
