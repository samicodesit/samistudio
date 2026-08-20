import { describe, expect, it } from "vitest";
import {
  SUPPORTED_LOCALES,
  buildPageMetadata,
  getCopy,
  getLanguageAlternates,
  hasLocale,
  htmlLang,
  localePath,
} from "./i18n";

describe("internationalization", () => {
  it("supports the nine approved language routes", () => {
    expect(SUPPORTED_LOCALES).toEqual(["en", "nl", "de", "fr", "es", "pt-br", "it", "ja", "ko"]);
    expect(localePath("en")).toBe("/");
    expect(localePath("pt-br")).toBe("/pt-br");
    expect(hasLocale("ko")).toBe(true);
    expect(hasLocale("unknown")).toBe(false);
    expect(htmlLang("pt-br")).toBe("pt-BR");
  });

  it("provides complete localized tool copy", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const copy = getCopy(locale);
      expect(copy.composer.title).not.toBe("");
      expect(copy.seo.introTitle).not.toBe("");
      expect(copy.suggestions.items).toHaveLength(3);
      expect(new Set(copy.suggestions.items).size).toBe(3);
    }

    expect(getCopy("de").composer.title).toBe("Was sollen wir zeichnen?");
    expect(getCopy("ja").composer.create).toBe("イラストを作る");
  });

  it("builds self-canonical localized metadata with reciprocal alternatives", () => {
    const metadata = buildPageMetadata("nl");

    expect(metadata.title).toContain("AI-doodlegenerator");
    expect(metadata.alternates?.canonical).toBe("https://doodle.samistudio.nl/nl");
    expect(metadata.alternates?.languages).toEqual(getLanguageAlternates());
    expect(metadata.robots).toMatchObject({ index: true, follow: true });
  });
});
