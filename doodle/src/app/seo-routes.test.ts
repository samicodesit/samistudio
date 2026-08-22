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

  it("lists every localized, ideas, and legal page", () => {
    const entries = sitemap();

    expect(entries).toHaveLength(SUPPORTED_LOCALES.length + 5);
    expect(entries.slice(0, SUPPORTED_LOCALES.length).map(({ url }) => url)).toEqual(
      SUPPORTED_LOCALES.map((locale) => `${SITE_URL}${localePath(locale)}`),
    );
    for (const entry of entries.slice(0, SUPPORTED_LOCALES.length)) {
      expect(entry.alternates?.languages).toEqual(getLanguageAlternates());
    }
    expect(entries.slice(SUPPORTED_LOCALES.length).map(({ url }) => url)).toEqual([
      `${SITE_URL}/doodle-ideas`,
      `${SITE_URL}/privacy`,
      `${SITE_URL}/terms`,
      `${SITE_URL}/refund`,
      `${SITE_URL}/contact`,
    ]);
    expect(entries.find(({ url }) => url.endsWith("/doodle-ideas"))?.images).toHaveLength(8);
  });
});
