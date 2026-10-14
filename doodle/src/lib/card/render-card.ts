import type { Locale } from "@/lib/i18n";
import { CLASSIC_CARD_FRAME, type CardFrame } from "./frame";

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 1500;
const MAX_MESSAGE_LENGTH = 80;
const MESSAGE_MAX_LINES = 3;
const MESSAGE_MAX_FONT_SIZE = 64;
const MESSAGE_MIN_FONT_SIZE = 32;
const MESSAGE_FONT_STEP = 2;
const MESSAGE_LINE_HEIGHT_RATIO = 1.28;

type TextMeasurer = (value: string) => number;

function graphemeSegments(value: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const Segmenter = Intl.Segmenter;
    return Array.from(new Segmenter(undefined, { granularity: "grapheme" }).segment(value), ({ segment }) => segment);
  }
  return Array.from(value);
}

export function countGraphemes(value: string): number {
  return graphemeSegments(value).length;
}

export function limitCardMessage(value: string, max = MAX_MESSAGE_LENGTH): string {
  return graphemeSegments(value).slice(0, max).join("");
}

function wrapOversizedWord(word: string, maxWidth: number, measureText: TextMeasurer): string[] {
  const chunks: string[] = [];
  let chunk = "";

  for (const segment of graphemeSegments(word)) {
    const candidate = chunk + segment;
    if (chunk && measureText(candidate) > maxWidth) {
      chunks.push(chunk);
      chunk = segment;
    } else {
      chunk = candidate;
    }
  }

  if (chunk) chunks.push(chunk);
  return chunks;
}

export function wrapCardMessage(value: string, maxWidth: number, measureText: TextMeasurer): string[] {
  const normalized = value.replace(/\r\n?/gu, "\n").trim();
  if (!normalized) return [];

  const lines: string[] = [];
  const paragraphs = normalized.split("\n");

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const cleanParagraph = paragraph.trim().replace(/[^\S\n]+/gu, " ");
    if (!cleanParagraph) {
      if (paragraphIndex > 0 && paragraphIndex < paragraphs.length - 1) lines.push("");
      return;
    }

    let line = "";
    for (const word of cleanParagraph.split(" ")) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && measureText(candidate) <= maxWidth) {
        line = candidate;
        continue;
      }

      if (line) {
        lines.push(line);
        line = "";
      }

      if (measureText(word) <= maxWidth) {
        line = word;
        continue;
      }

      const chunks = wrapOversizedWord(word, maxWidth, measureText);
      if (chunks.length > 1) lines.push(...chunks.slice(0, -1));
      line = chunks.at(-1) ?? "";
    }

    if (line) lines.push(line);
  });

  return lines;
}

function cardFont(locale: Locale, size: number): string {
  return locale === "ar" ? `600 ${size}px "Alexandria"` : `600 ${size}px "Bricolage Grotesque"`;
}

function fitCardMessage(
  value: string,
  maxWidth: number,
  measureText: (value: string) => number,
  setFont: (size: number) => void,
): { fontSize: number; lines: string[]; lineHeight: number } {
  let fontSize = MESSAGE_MIN_FONT_SIZE;
  let lines: string[] = [];

  for (let candidateSize = MESSAGE_MAX_FONT_SIZE; candidateSize >= MESSAGE_MIN_FONT_SIZE; candidateSize -= MESSAGE_FONT_STEP) {
    setFont(candidateSize);
    const candidateLines = wrapCardMessage(value, maxWidth, measureText);
    fontSize = candidateSize;
    lines = candidateLines;
    if (candidateLines.length <= MESSAGE_MAX_LINES) break;
  }

  return {
    fontSize,
    lines,
    lineHeight: Math.round(fontSize * MESSAGE_LINE_HEIGHT_RATIO),
  };
}

async function loadCardFonts(locale: Locale): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  await document.fonts.ready;
  await Promise.all([
    document.fonts.load('600 64px "Bricolage Grotesque"'),
    document.fonts.load(cardFont(locale, MESSAGE_MAX_FONT_SIZE)),
  ]);
}

function drawContainedImage(ctx: CanvasRenderingContext2D, image: CanvasImageSource, x: number, y: number, width: number, height: number) {
  const sizedImage = image as CanvasImageSource & { width?: number; height?: number; videoWidth?: number; videoHeight?: number };
  const sourceWidth = sizedImage.videoWidth || sizedImage.width;
  const sourceHeight = sizedImage.videoHeight || sizedImage.height;
  if (!sourceWidth || !sourceHeight) throw new Error("Card image has no dimensions");
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const bounds = { x: x + (width - drawWidth) / 2, y: y + (height - drawHeight) / 2, width: drawWidth, height: drawHeight };
  ctx.drawImage(image, bounds.x, bounds.y, bounds.width, bounds.height);
  return bounds;
}

export async function renderCardBlob(source: Blob, message: string, locale: Locale, frame: CardFrame = CLASSIC_CARD_FRAME): Promise<Blob> {
  await loadCardFonts(locale);
  const bitmap = await createImageBitmap(source);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable");

    ctx.fillStyle = frame.paperColor;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
    const imageX = frame.imageInset;
    const imageY = frame.imageTop;
    const imageWidth = CARD_WIDTH - frame.imageInset * 2;
    const imageHeight = frame.imageHeight;
    const imageBounds = drawContainedImage(ctx, bitmap, imageX, imageY, imageWidth, imageHeight);
    if (frame.borderWidth > 0) {
      // Frames hug the actual artwork, including non-square source images.
      const inset = frame.borderWidth / 2;
      ctx.strokeStyle = frame.borderColor;
      ctx.lineWidth = frame.borderWidth;
      ctx.strokeRect(imageBounds.x + inset, imageBounds.y + inset, imageBounds.width - frame.borderWidth, imageBounds.height - frame.borderWidth);
    }

    const cleanMessage = limitCardMessage(message);
    if (cleanMessage) {
      ctx.fillStyle = frame.inkColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.direction = locale === "ar" ? "rtl" : "ltr";
      const layout = fitCardMessage(
        cleanMessage,
        frame.messageMaxWidth,
        value => ctx.measureText(value).width,
        size => {
          ctx.font = cardFont(locale, size);
        },
      );
      ctx.font = cardFont(locale, layout.fontSize);
      const startY = frame.messageCenterY - ((layout.lines.length - 1) * layout.lineHeight) / 2;
      layout.lines.forEach((line, index) => ctx.fillText(line, CARD_WIDTH / 2, startY + index * layout.lineHeight));
    }

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Card export failed")), "image/png");
    });
  } finally {
    bitmap.close();
  }
}

export function canShareCard(data: ShareData): boolean {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare(data);
  } catch {
    return false;
  }
}
