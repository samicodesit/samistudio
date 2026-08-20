import { describe, expect, it } from "vitest";
import robots from "./robots";
import sitemap from "./sitemap";
import { SITE_URL, SUPPORTED_LOCALES, getLanguageAlternates, localePath } from "@/lib/i18n";

describe("search engine routes", () => {
  it("allows public pages while keeping generation endpoints out of the index", () => {
    expect(robots()).toEqual({
      rules: { userAgent: "*", allow: "/", disallow: "/api/" },
      sitemap: `${SITE_URL}/sitemap.xml`,
      host: SITE_URL,
    });
  });

  it("lists every localized page with reciprocal language alternatives", () => {
    const entries = sitemap();

    expect(entries).toHaveLength(SUPPORTED_LOCALES.length);
    expect(entries.map(({ url }) => url)).toEqual(
      SUPPORTED_LOCALES.map((locale) => `${SITE_URL}${localePath(locale)}`),
    );
    for (const entry of entries) {
      expect(entry.alternates?.languages).toEqual(getLanguageAlternates());
    }
  });
});
