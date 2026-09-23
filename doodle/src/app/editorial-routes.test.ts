import { describe, expect, it } from "vitest";
import { render, within } from "@testing-library/react";
import { createElement } from "react";
import sitemap from "./sitemap";
import {
  ARTICLE_SLUGS,
  EDITORIAL_REVIEW,
  getEditorialCopy,
  getLocalizedArticle,
  getEditorialPath,
} from "@/lib/editorial";
import { buildEditorialMetadata, ForAiPage } from "@/components/editorial-pages";
import { SITE_URL, SUPPORTED_LOCALES, htmlLang } from "@/lib/i18n";

describe("editorial SEO content", () => {
  it("has useful localized blog and assistant copy for every supported locale", () => {
    expect(EDITORIAL_REVIEW.sourceDate).toBe("2026-09-23");
    expect(EDITORIAL_REVIEW.demandSignals.length).toBeGreaterThan(0);

    for (const locale of SUPPORTED_LOCALES) {
      const copy = getEditorialCopy(locale);
      expect(copy.blog.title.length).toBeGreaterThan(10);
      expect(copy.forAi.title.length).toBeGreaterThan(10);
      for (const slug of ARTICLE_SLUGS) {
        const article = getLocalizedArticle(locale, slug);
        expect(article.title.length).toBeGreaterThan(10);
        expect(article.steps.length).toBeGreaterThanOrEqual(3);
        expect(article.steps.every((step) => step.body.length > 30)).toBe(true);
      }
    }
  });

  it("uses one canonical and one hreflang URL for each localized editorial page", () => {
    const articlePath = getEditorialPath("ar", "blog", "journal-doodles");
    expect(articlePath).toBe("/ar/blog/journal-doodles");
    const entries = sitemap();
    const articleEntries = entries.filter(({ url }) => url.includes("/blog/") || url.endsWith("/blog") || url.includes("/for-ai"));
    expect(articleEntries).toHaveLength(SUPPORTED_LOCALES.length * (ARTICLE_SLUGS.length + 2));
    for (const entry of articleEntries) {
      expect(entry.alternates?.languages).toBeDefined();
      expect(Object.keys(entry.alternates?.languages ?? {})).toContain(htmlLang("ar"));
      expect(entry.url.startsWith(SITE_URL)).toBe(true);
    }
  });

  it("gives each article a unique canonical and article metadata", () => {
    const metadata = buildEditorialMetadata("fr", "blog", "card-doodles");
    expect(metadata.title).toContain("carte");
    expect(metadata.description).toContain("doodle");
    expect(metadata.alternates?.canonical).toBe(`${SITE_URL}/fr/blog/card-doodles`);
    expect(metadata.openGraph).toBeDefined();
    expect(Object.keys(metadata.alternates?.languages ?? {})).toHaveLength(SUPPORTED_LOCALES.length + 1);
  });

  it("keeps the privacy reference in the assistant page as a crawlable inline link", () => {
    const { container } = render(createElement(ForAiPage, { locale: "ja" }));
    const main = within(container).getByRole("main");
    expect(within(main).getByRole("link", { name: "プライバシー" })).toHaveAttribute("href", "/privacy");
  });
});
