import type { PaperColorId } from "./generation/paper-colors";
type PaperColorCopy = { heading: string; label: string; colors: Record<PaperColorId, string> };
const names: Record<string, readonly [string, string, string, string, string, string, string, string]> = {
  en: ["Paper", "Yellow", "Pink", "Peach", "Mint", "Blue", "Lavender", "White"],
  nl: ["Papier", "Geel", "Roze", "Perzik", "Mint", "Blauw", "Lavendel", "Wit"],
  de: ["Papier", "Gelb", "Rosa", "Pfirsich", "Mint", "Blau", "Lavendel", "Weiß"],
  fr: ["Papier", "Jaune", "Rose", "Pêche", "Menthe", "Bleu", "Lavande", "Blanc"],
  es: ["Papel", "Amarillo", "Rosa", "Melocotón", "Menta", "Azul", "Lavanda", "Blanco"],
  "pt-br": ["Papel", "Amarelo", "Rosa", "Pêssego", "Menta", "Azul", "Lavanda", "Branco"],
  it: ["Carta", "Giallo", "Rosa", "Pesca", "Menta", "Blu", "Lavanda", "Bianco"],
  ja: ["紙", "黄色", "ピンク", "ピーチ", "ミント", "青", "ラベンダー", "白"],
  ko: ["종이", "노랑", "분홍", "복숭아", "민트", "파랑", "라벤더", "흰색"],
  ar: ["الورق", "أصفر", "وردي", "خوخي", "نعناعي", "أزرق", "لافندر", "أبيض"],
};
export function getPaperColorCopy(locale: string): PaperColorCopy {
  const [heading, yellow, pink, peach, mint, blue, lavender, white] = names[locale] ?? names.en;
  return { heading, label: heading, colors: { yellow, pink, peach, mint, blue, lavender, white } };
}
