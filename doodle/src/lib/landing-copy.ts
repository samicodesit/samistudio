import type { Locale } from "./i18n";
import { getDoodleIdeas } from "./doodle-ideas";

// The web landing page adds presentation copy, not a separate generation flow.
const LABELS: Record<Locale, readonly [string, string, string, string, string, string, string, string, string, string, string, string]> = {
  en: ["Your words.", "A little drawing.", "Drawing ideas for cards, lunchbox notes and journals.", "Examples", "Try an idea:", "Birthday card", "Lunchbox note", "Journal", "Example drawing", "Make a little moment personal.", "Copy the drawing by hand, add it to a card, or download and share it.", "Doodle on your phone."],
  nl: ["Jouw woorden.", "Een kleine tekening.", "Tekenideeën voor kaarten, broodtrommelbriefjes en dagboeken.", "Voorbeelden", "Probeer een idee:", "Verjaardagskaart", "Broodtrommelbriefje", "Dagboek", "Voorbeeldtekening", "Maak een klein moment persoonlijk.", "Teken het na, voeg het toe aan een kaart of download en deel het.", "Doodle op je telefoon."],
  de: ["Deine Worte.", "Eine kleine Zeichnung.", "Zeichenideen für Karten, Brotdosen-Zettel und Tagebücher.", "Beispiele", "Probier eine Idee:", "Geburtstagskarte", "Brotdosen-Zettel", "Tagebuch", "Beispielzeichnung", "Mach einen kleinen Moment persönlich.", "Zeichne es nach, füge es einer Karte hinzu oder lade es herunter und teile es.", "Doodle auf deinem Handy."],
  fr: ["Vos mots.", "Un petit dessin.", "Des idées de dessins pour les cartes, petits mots et journaux.", "Exemples", "Essayez une idée :", "Carte d’anniversaire", "Petit mot", "Journal", "Exemple de dessin", "Personnalisez un petit moment.", "Recopiez le dessin, ajoutez-le à une carte ou téléchargez-le et partagez-le.", "Doodle sur votre téléphone."],
  es: ["Tus palabras.", "Un pequeño dibujo.", "Ideas de dibujos para tarjetas, notas y diarios.", "Ejemplos", "Prueba una idea:", "Tarjeta de cumpleaños", "Nota para el almuerzo", "Diario", "Dibujo de ejemplo", "Haz personal un pequeño momento.", "Copia el dibujo a mano, añádelo a una tarjeta o descárgalo y compártelo.", "Doodle en tu teléfono."],
  "pt-br": ["Suas palavras.", "Um pequeno desenho.", "Ideias de desenhos para cartões, bilhetes e diários.", "Exemplos", "Experimente uma ideia:", "Cartão de aniversário", "Bilhete na lancheira", "Diário", "Desenho de exemplo", "Dê seu toque a um pequeno momento.", "Copie o desenho à mão, adicione a um cartão ou baixe e compartilhe.", "Doodle no seu celular."],
  it: ["Le tue parole.", "Un piccolo disegno.", "Idee da disegnare per biglietti, messaggi e diari.", "Esempi", "Prova un’idea:", "Biglietto di compleanno", "Messaggio per il pranzo", "Diario", "Disegno di esempio", "Rendi personale un piccolo momento.", "Copia il disegno a mano, aggiungilo a un biglietto o scaricalo e condividilo.", "Doodle sul tuo telefono."],
  ja: ["あなたの言葉。", "小さなイラスト。", "カード、お弁当のメモ、日記に添えるイラストのアイデア。", "作例", "アイデアを試す：", "誕生日カード", "お弁当のメモ", "日記", "イラストの例", "小さな瞬間に、あなたらしさを。", "手で描き写したり、カードに添えたり、ダウンロードして共有できます。", "スマートフォンでDoodle。"],
  ko: ["당신의 말.", "작은 그림 하나.", "카드, 도시락 메모, 일기를 위한 그림 아이디어.", "예시", "아이디어를 골라 보세요:", "생일 카드", "도시락 메모", "일기", "그림 예시", "작은 순간에 마음을 담아 보세요.", "손으로 따라 그리거나 카드에 넣고, 다운로드하거나 공유하세요.", "휴대폰에서도 Doodle."],
  ar: ["كلماتك.", "رسمة صغيرة.", "أفكار للرسم على البطاقات ورسائل الغداء واليوميات.", "أمثلة", "جرّب فكرة:", "بطاقة عيد ميلاد", "رسالة للغداء", "يوميات", "مثال للرسم", "اجعل لحظة صغيرة شخصية.", "انقل الرسمة بيدك، أو أضفها إلى بطاقة، أو نزّلها وشاركها.", "Doodle على هاتفك."],
};

export function getLandingCopy(locale: Locale) {
  const [title, titleEnd, subtitle, examples, tryIdea, birthday, lunchbox, journal, exampleLabel, momentTitle, momentBody, phoneTitle] = LABELS[locale];
  const ideas = getDoodleIdeas(locale);
  const examplePrompt = locale === "en" ? "A happy dog holding a birthday balloon" : ideas.featured[2];
  return {
    title, titleEnd, subtitle, examples, tryIdea, exampleLabel, momentTitle, momentBody, phoneTitle, examplePrompt,
    placeholderPrompts: [examplePrompt, ideas.quickIdeas[2], ideas.featured[5], ideas.quickIdeas[0], ideas.quickIdeas[13]],
    suggestions: [
      { label: birthday, prompt: examplePrompt },
      { label: lunchbox, prompt: ideas.featured[5] },
      { label: journal, prompt: ideas.featured[1] },
    ],
  };
}

export type LandingCopy = ReturnType<typeof getLandingCopy>;
export const LANDING_EXAMPLE = "/landing/birthday-dog.webp";
