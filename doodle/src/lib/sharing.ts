import { localePath, SITE_URL, type Locale } from "./i18n";

interface ShareCopy {
  share: string;
  text: string;
  copied: string;
  manual: string;
  link: string;
}

export const SHARE_COPY: Record<Locale, ShareCopy> = {
  en: { share: "Share doodle", text: "A tiny drawing for someone you love. Make your own with Doodle — first 2 doodles free.", copied: "Link copied. Send it with your downloaded doodle.", manual: "Copy this link and send it with your doodle.", link: "Link to Doodle" },
  nl: { share: "Deel doodle", text: "Een kleine tekening voor iemand om wie je geeft. Maak er zelf een met Doodle — de eerste 2 zijn gratis.", copied: "Link gekopieerd. Stuur hem mee met je gedownloade doodle.", manual: "Kopieer deze link en stuur hem mee met je doodle.", link: "Link naar Doodle" },
  de: { share: "Doodle teilen", text: "Eine kleine Zeichnung für einen lieben Menschen. Zeichne mit Doodle — die ersten 2 Doodles sind kostenlos.", copied: "Link kopiert. Verschicke ihn mit deinem heruntergeladenen Doodle.", manual: "Kopiere diesen Link und verschicke ihn mit deinem Doodle.", link: "Link zu Doodle" },
  fr: { share: "Partager le doodle", text: "Un petit dessin pour quelqu’un que vous aimez. Créez le vôtre avec Doodle — les 2 premiers sont gratuits.", copied: "Lien copié. Envoyez-le avec votre doodle téléchargé.", manual: "Copiez ce lien et envoyez-le avec votre doodle.", link: "Lien vers Doodle" },
  es: { share: "Compartir doodle", text: "Un pequeño dibujo para alguien que quieres. Crea el tuyo con Doodle — los primeros 2 son gratis.", copied: "Enlace copiado. Envíalo con tu doodle descargado.", manual: "Copia este enlace y envíalo con tu doodle.", link: "Enlace a Doodle" },
  "pt-br": { share: "Compartilhar doodle", text: "Um pequeno desenho para alguém que você ama. Crie o seu com Doodle — os 2 primeiros são grátis.", copied: "Link copiado. Envie com o doodle que você baixou.", manual: "Copie este link e envie com seu doodle.", link: "Link para o Doodle" },
  it: { share: "Condividi doodle", text: "Un piccolo disegno per qualcuno a cui vuoi bene. Crea il tuo con Doodle — i primi 2 sono gratis.", copied: "Link copiato. Invialo con il doodle scaricato.", manual: "Copia questo link e invialo con il tuo doodle.", link: "Link a Doodle" },
  ja: { share: "シェアする", text: "大切な人へ、小さなイラストを。Doodleで作ってみよう。最初の2枚は無料です。", copied: "リンクをコピーしました。ダウンロードしたイラストと一緒に送ってください。", manual: "このリンクをコピーして、イラストと一緒に送ってください。", link: "Doodleへのリンク" },
  ko: { share: "그림 공유", text: "소중한 사람을 위한 작은 그림. Doodle로 만들어 보세요. 처음 2장은 무료예요.", copied: "링크를 복사했어요. 다운로드한 그림과 함께 보내세요.", manual: "이 링크를 복사해 그림과 함께 보내세요.", link: "Doodle 링크" },
  ar: { share: "مشاركة الرسمة", text: "رسمة صغيرة لشخص تحبه. اصنع رسمتك مع Doodle — أول رسمتين مجانًا.", copied: "تم نسخ الرابط. أرسله مع الرسمة التي نزّلتها.", manual: "انسخ هذا الرابط وأرسله مع رسمتك.", link: "رابط Doodle" },
};

export function doodleShareUrl(locale: Locale): string {
  const url = new URL(localePath(locale), SITE_URL);
  url.searchParams.set("utm_source", "doodle");
  url.searchParams.set("utm_medium", "share");
  url.searchParams.set("utm_campaign", "made_with_doodle");
  return url.toString();
}
