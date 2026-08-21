import { describe, expect, it } from "vitest";
import {
  SUPPORTED_LOCALES,
  buildPageMetadata,
  formatCount,
  getCopy,
  getLanguageAlternates,
  hasLocale,
  htmlLang,
  localePath,
  textDirection,
} from "./i18n";

function stringValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringValues);
  if (value && typeof value === "object") return Object.values(value).flatMap(stringValues);
  return [];
}

describe("internationalization", () => {
  it("supports the ten approved language routes", () => {
    expect(SUPPORTED_LOCALES).toEqual(["en", "nl", "de", "fr", "es", "pt-br", "it", "ja", "ko", "ar"]);
    expect(localePath("en")).toBe("/");
    expect(localePath("pt-br")).toBe("/pt-br");
    expect(hasLocale("ko")).toBe(true);
    expect(hasLocale("unknown")).toBe(false);
    expect(htmlLang("pt-br")).toBe("pt-BR");
    expect(htmlLang("ar")).toBe("ar");
    expect(textDirection("ar")).toBe("rtl");
    expect(textDirection("en")).toBe("ltr");
  });

  it("provides complete localized tool copy", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const copy = getCopy(locale);
      expect(stringValues(copy).every((value) => value.trim() !== "")).toBe(true);
      expect(JSON.parse(JSON.stringify(copy))).toEqual(copy);
      expect(copy.suggestions.items).toHaveLength(3);
      expect(new Set(copy.suggestions.items).size).toBe(3);
      expect(formatCount(locale, copy.usage.freeLeft, 1)).not.toBe("");
      expect(formatCount(locale, copy.usage.freeLeft, 2)).not.toBe("");
      expect(formatCount(locale, copy.usage.paidLeft, 1)).not.toBe("");
      expect(formatCount(locale, copy.usage.paidLeft, 2)).not.toBe("");
      expect(formatCount(locale, copy.account.balance, 1)).not.toBe("");
      expect(formatCount(locale, copy.account.balance, 2)).not.toBe("");
    }

    expect(getCopy("de").composer.title).toBe("Was sollen wir zeichnen?");
    expect(getCopy("ja").composer.create).toBe("イラストを作る");
    expect(getCopy("ar").composer.title).toBe("ماذا نرسم؟");
    expect(getCopy("ar").seo.title).toContain("مولّد رسومات بسيطة بالذكاء الاصطناعي");
  });

  it("formats every Arabic plural category without crossing the RSC boundary with functions", () => {
    const templates = getCopy("ar").usage.freeLeft;

    expect(Object.keys(templates)).toEqual(["zero", "one", "two", "few", "many", "other"]);
    expect(formatCount("ar", templates, 0)).toBe("لم تتبقَّ أي رسومات مجانية");
    expect(formatCount("ar", templates, 1)).toBe("تبقّت لك رسمة مجانية واحدة");
    expect(formatCount("ar", templates, 2)).toBe("تبقّت لك رسمتان مجانيتان");
    expect(formatCount("ar", templates, 3)).toBe("تبقّت لك 3 رسومات مجانية");
    expect(formatCount("ar", templates, 11)).toBe("تبقّت لك 11 رسمة مجانية");
    expect(formatCount("ar", templates, 100)).toBe("تبقّت لك 100 رسمة مجانية");
    expect(stringValues(getCopy("ar")).join(" ").replaceAll("Doodle", "")).not.toMatch(/[A-Za-z]/);
  });

  it("builds self-canonical localized metadata with reciprocal alternatives", () => {
    const metadata = buildPageMetadata("nl");

    expect(metadata.title).toContain("AI-doodlegenerator");
    expect(metadata.alternates?.canonical).toBe("https://doodle.samistudio.nl/nl");
    expect(metadata.alternates?.languages).toEqual(getLanguageAlternates());
    expect(metadata.robots).toMatchObject({ index: true, follow: true });
  });
});
