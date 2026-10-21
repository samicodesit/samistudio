/** Shared with web and native. Keep this module free of runtime/environment dependencies. */
export const PAPER_COLORS = [
  { id: "yellow", hex: "#FFEB8A" },
  { id: "pink", hex: "#F5BDD2" },
  { id: "peach", hex: "#FFD0A6" },
  { id: "mint", hex: "#C7E5B7" },
  { id: "blue", hex: "#BCDCF2" },
  { id: "lavender", hex: "#D8C9EE" },
  { id: "white", hex: "#FFFFFF" },
] as const;
export type PaperColorId = (typeof PAPER_COLORS)[number]["id"];
export const DEFAULT_PAPER_COLOR: PaperColorId = "yellow";
export const PAPER_COLOR_STORAGE_KEY = "doodle.paper-color";
export function isPaperColorId(value: unknown): value is PaperColorId {
  return PAPER_COLORS.some(color => color.id === value);
}
export function storedPaperColor(value: unknown): PaperColorId {
  return isPaperColorId(value) ? value : DEFAULT_PAPER_COLOR;
}
export function paperColorHex(id: PaperColorId): string {
  const color = PAPER_COLORS.find(color => color.id === id);
  if (!color) throw new Error("Invalid paper color");
  return color.hex;
}
/** Transform only controlled prompt templates, before user text is appended. */
export function colorPaperPrompt(template: string, id: PaperColorId): string {
  if (id === "yellow") return template;
  return template
    .replace(/warm, muted\n  yellow with a little saturation, not cream, orange, or neon yellow/g, id === "white" ? "clean neutral white, not gray, cream, or tinted" : `soft pastel ${id}, not white or neon`)
    .replace(/#FFEB8A/g, paperColorHex(id))
    .replace(/warm-yellow|yellow/g, id);
}
