import { describe, expect, it } from "vitest";
import { SUPPORTED_LOCALES } from "./i18n";
import { buildDoodleIdeasMetadata, getDoodleIdeas, ideasPath } from "./doodle-ideas";

describe("localized doodle ideas", () => {
  it("provides natural localized gallery copy and prompts", () => {
    const arabic = getDoodleIdeas("ar");

    expect(arabic.title).toBe("أفكار رسومات بسيطة لكل مناسبة");
    expect(arabic.featured).toHaveLength(8);
    expect(arabic.quickIdeas).toHaveLength(20);
    expect(arabic.featured.join(" ")).not.toMatch(/birthday|note|doodle/i);

    for (const locale of SUPPORTED_LOCALES) {
      expect(getDoodleIdeas(locale).featured).toHaveLength(8);
      expect(getDoodleIdeas(locale).quickIdeas).toHaveLength(20);
    }
  });

  it("builds localized gallery paths and discovery metadata", () => {
    expect(ideasPath("en")).toBe("/doodle-ideas");
    expect(ideasPath("nl")).toBe("/nl/doodle-ideas");

    const metadata = buildDoodleIdeasMetadata("nl");
    expect(metadata.alternates).toMatchObject({
      canonical: "https://doodle.samistudio.nl/nl/doodle-ideas",
      languages: {
        en: "https://doodle.samistudio.nl/doodle-ideas",
        nl: "https://doodle.samistudio.nl/nl/doodle-ideas",
      },
    });
    expect(metadata.openGraph).toMatchObject({ locale: "nl_NL" });
  });
});
