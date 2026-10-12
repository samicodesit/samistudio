import { describe, expect, it } from "vitest";
import { getGalleryItems } from "./gallery-catalog";
import { SUPPORTED_LOCALES } from "./i18n";

describe("curated gallery", () => {
  it.each(SUPPORTED_LOCALES)("has 31 complete, uniquely identified examples in %s", locale => {
    const items = getGalleryItems(locale);
    expect(items).toHaveLength(31);
    expect(new Set(items.map(item => item.id)).size).toBe(31);
    expect(["simple", "medium", "detailed"].map(level => items.filter(item => item.detailLevel === level).length)).toEqual([18, 6, 7]);
    for (const item of items) {
      expect(item.caption.trim()).not.toBe("");
      expect(item.prompt.trim()).not.toBe("");
      expect(item.image).toMatch(/^\/ideas\/.+\.webp$/);
      expect(item.width).toBeGreaterThanOrEqual(900);
      expect(item.height).toBe(item.width);
    }
  });
});
