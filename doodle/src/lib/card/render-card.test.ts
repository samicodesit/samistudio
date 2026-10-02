import { describe, expect, it, vi } from "vitest";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  countGraphemes,
  limitCardMessage,
  renderCardBlob,
  wrapCardMessage,
} from "@/lib/card/render-card";

describe("card message layout", () => {
  it("limits by grapheme clusters without splitting emoji sequences", () => {
    const value = "👩‍👩‍👧‍👦".repeat(80);

    expect(countGraphemes(limitCardMessage(value, 80))).toBe(80);
    expect(limitCardMessage(value, 80).slice(0, 11)).toBe("👩‍👩‍👧‍👦");
  });

  it("wraps words and long runs while retaining the complete message", () => {
    const measure = (value: string) => value.length * 10;
    const message = "A thoughtful note with a supercalifragilistic word";

    const lines = wrapCardMessage(message, 120, measure);
    expect(lines.slice(0, 2)).toEqual(["A thoughtful", "note with a"]);
    expect(lines.join("").replace(/\s/gu, "")).toBe(message.replace(/\s/gu, ""));
    expect(wrapCardMessage("مرحبا بك", 50, measure).join("")).toBe("مرحبابك");
  });

  it("keeps Arabic words whole until one token is too wide", () => {
    const measure = (value: string) => value.length * 10;
    const message = "هذه رسالة عربية طويلة لشخص تحبه";
    const lines = wrapCardMessage(message, 100, measure);

    expect(lines).toEqual(["هذه رسالة", "عربية", "طويلة لشخص", "تحبه"]);
    expect(lines.every(line => measure(line) <= 100)).toBe(true);
    expect(lines.join(" ")).toBe(message);
  });

  it("preserves explicit line breaks between wrapped paragraphs", () => {
    const measure = (value: string) => value.length * 10;

    expect(wrapCardMessage("هذه رسالة\nعربية", 100, measure)).toEqual(["هذه رسالة", "عربية"]);
  });
});

describe("card export contract", () => {
  it("keeps image gutters paper-colored and preserves a non-square image", async () => {
    const fills: string[] = [];
    const context = {
      fillStyle: "",
      fillRect: vi.fn(() => fills.push(context.fillStyle)),
      strokeRect: vi.fn(),
      drawImage: vi.fn(),
    };
    const bitmap = { width: 1200, height: 800, close: vi.fn() };
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(callback => callback(new Blob(["card"], { type: "image/png" })));

    try {
      await renderCardBlob(new Blob(["source"]), "", "en");
      expect(fills).toEqual(["#fcfcf8"]);
      const [source, x, y, width, height] = context.drawImage.mock.calls[0] as unknown as [unknown, number, number, number, number];
      expect(source).toBe(bitmap);
      expect(width / height).toBeCloseTo(1.5);
      expect(x).toBeGreaterThan(0);
      expect(y).toBeGreaterThan(0);
      expect(x + width).toBeLessThan(CARD_WIDTH);
      expect(y + height).toBeLessThan(CARD_HEIGHT);
      expect(bitmap.close).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps a fixed portrait export size", () => {
    expect(CARD_WIDTH / CARD_HEIGHT).toBe(0.8);
  });
});
