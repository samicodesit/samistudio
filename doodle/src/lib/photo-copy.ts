import type { Locale } from "./i18n";

export interface PhotoCopy {
  use: string; change: string; remove: string; hint: string; alt: string;
  preparing: string; invalid: string; tooLarge: string;
}
const PHOTO_COPY: Record<Locale, PhotoCopy> = {
  en: { use: "Use a photo", change: "Change photo", remove: "Remove", hint: "From your photo", alt: "Selected photo", preparing: "Preparing photo…", invalid: "This photo could not be opened. Try a JPG, PNG or WebP image.", tooLarge: "That photo is too large. Try a smaller image." },
  nl: { use: "Foto gebruiken", change: "Foto wijzigen", remove: "Verwijderen", hint: "Van jouw foto", alt: "Geselecteerde foto", preparing: "Foto voorbereiden…", invalid: "Deze foto kon niet worden geopend. Probeer een JPG-, PNG- of WebP-afbeelding.", tooLarge: "Die foto is te groot. Probeer een kleinere afbeelding." },
  de: { use: "Foto verwenden", change: "Foto ändern", remove: "Entfernen", hint: "Aus deinem Foto", alt: "Ausgewähltes Foto", preparing: "Foto wird vorbereitet…", invalid: "Dieses Foto konnte nicht geöffnet werden. Versuche ein JPG-, PNG- oder WebP-Bild.", tooLarge: "Dieses Foto ist zu groß. Versuche ein kleineres Bild." },
  fr: { use: "Utiliser une photo", change: "Changer de photo", remove: "Retirer", hint: "À partir de votre photo", alt: "Photo sélectionnée", preparing: "Préparation de la photo…", invalid: "Impossible d’ouvrir cette photo. Essayez une image JPG, PNG ou WebP.", tooLarge: "Cette photo est trop volumineuse. Essayez une image plus petite." },
  es: { use: "Usar una foto", change: "Cambiar foto", remove: "Quitar", hint: "A partir de tu foto", alt: "Foto seleccionada", preparing: "Preparando foto…", invalid: "No se pudo abrir esta foto. Prueba una imagen JPG, PNG o WebP.", tooLarge: "Esa foto es demasiado grande. Prueba una imagen más pequeña." },
  "pt-br": { use: "Usar uma foto", change: "Trocar foto", remove: "Remover", hint: "A partir da sua foto", alt: "Foto selecionada", preparing: "Preparando foto…", invalid: "Não foi possível abrir esta foto. Tente uma imagem JPG, PNG ou WebP.", tooLarge: "Essa foto é muito grande. Tente uma imagem menor." },
  it: { use: "Usa una foto", change: "Cambia foto", remove: "Rimuovi", hint: "Dalla tua foto", alt: "Foto selezionata", preparing: "Preparazione della foto…", invalid: "Impossibile aprire questa foto. Prova un’immagine JPG, PNG o WebP.", tooLarge: "La foto è troppo grande. Prova un’immagine più piccola." },
  ja: { use: "写真を使う", change: "写真を変更", remove: "削除", hint: "あなたの写真から", alt: "選択した写真", preparing: "写真を準備中…", invalid: "この写真を開けませんでした。JPG、PNG、WebP画像をお試しください。", tooLarge: "写真が大きすぎます。小さい画像をお試しください。" },
  ko: { use: "사진 사용", change: "사진 변경", remove: "삭제", hint: "내 사진으로", alt: "선택한 사진", preparing: "사진 준비 중…", invalid: "이 사진을 열 수 없습니다. JPG, PNG 또는 WebP 이미지를 사용해 주세요.", tooLarge: "사진이 너무 큽니다. 더 작은 이미지를 사용해 주세요." },
  ar: { use: "استخدام صورة", change: "تغيير الصورة", remove: "إزالة", hint: "من صورتك", alt: "الصورة المختارة", preparing: "جارٍ تجهيز الصورة…", invalid: "تعذّر فتح هذه الصورة. جرّب صورة بصيغة JPG أو PNG أو WebP.", tooLarge: "هذه الصورة كبيرة جدًا. جرّب صورة أصغر." },
};
export function getPhotoCopy(locale: Locale): PhotoCopy { return PHOTO_COPY[locale]; }
