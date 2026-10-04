import type { Locale } from "./i18n";

// Shared compact entry copy for web, installed web and native Android.
const INTRO: Record<Locale, { title: string; hint: string }> = {
  en: { title: "Let’s doodle.", hint: "What’s your idea?" },
  nl: { title: "Teken maar.", hint: "Wat is je idee?" },
  de: { title: "Zeichnen wir.", hint: "Was ist deine Idee?" },
  fr: { title: "Dessinons.", hint: "Quelle est votre idée ?" },
  es: { title: "Dibujemos.", hint: "¿Cuál es tu idea?" },
  "pt-br": { title: "Vamos desenhar.", hint: "Qual é a sua ideia?" },
  it: { title: "Disegniamo.", hint: "Qual è la tua idea?" },
  ja: { title: "描いてみよう。", hint: "どんなアイデア？" },
  ko: { title: "그려 볼까요?", hint: "어떤 아이디어인가요?" },
  ar: { title: "لنرسم.", hint: "ما فكرتك؟" },
};

export function getComposerIntro(locale: Locale) {
  return INTRO[locale];
}
