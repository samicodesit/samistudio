import { describe, expect, it } from "vitest";
import { SUPPORTED_LOCALES } from "../../../src/lib/i18n";
import { getNativeCopy, getNativeIdeas, getNativeLocales, getNativeSupportLinks, getNativeUsageLabel, nativeDirection } from "./localization";

describe("native localization adapter", () => {
  it("projects every supported locale without web-only fields", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const copy = getNativeCopy(locale);
      expect(copy.composer.title).toBeTruthy();
      expect(copy.navigation.create).toBeTruthy();
      expect(copy.report.reasons.other).toBeTruthy();
      expect("seo" in copy).toBe(false);
    }
  });

  it("keeps Arabic RTL and every other supported locale LTR", () => {
    expect(nativeDirection("ar")).toBe("rtl");
    expect(SUPPORTED_LOCALES.filter((locale) => locale !== "ar").every((locale) => nativeDirection(locale) === "ltr")).toBe(true);
  });

  it("keeps the eight idea assets in the contract order", () => {
    const ideas = getNativeIdeas("en", [
      ["thank-you-mug", "thank-you-mug"],
      ["cat-note", "cat-note"],
      ["birthday-dog", "birthday-dog"],
      ["warm-hug", "warm-hug"],
      ["super-banana", "super-banana"],
      ["lunch-high-five", "lunch-high-five"],
      ["pencil-helps-eraser", "pencil-helps-eraser"],
      ["school-snail", "school-snail"],
    ]);
    expect(ideas).toHaveLength(8);
    expect(ideas.map((idea) => idea.id)).toEqual([
      "thank-you-mug",
      "cat-note",
      "birthday-dog",
      "warm-hug",
      "super-banana",
      "lunch-high-five",
      "pencil-helps-eraser",
      "school-snail",
    ]);
    expect(ideas.every((idea) => idea.prompt.length > 0 && idea.actionLabel.length > 0)).toBe(true);
  });

  it("projects localized language and support choices", () => {
    expect(getNativeLocales()).toHaveLength(10);
    expect(getNativeLocales().find((locale) => locale.value === "pt-br")?.label).toBe("Português (Brasil)");
    expect(getNativeSupportLinks("en").map((link) => link.id)).toEqual(["contact", "privacy", "terms", "refunds"]);
  });

  it("formats usage labels without relying on web-only Intl plural APIs", () => {
    expect(getNativeUsageLabel("en", 1, null)).toBe("1 free doodle left");
    expect(getNativeUsageLabel("en", 2, null)).toBe("2 free doodles left");
    expect(getNativeUsageLabel("en", null, 1)).toBe("1 doodle left");
    expect(getNativeUsageLabel("en", 1, 0)).toBe("1 free doodle left");
  });
});
