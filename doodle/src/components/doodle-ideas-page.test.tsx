import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DoodleIdeasPage } from "./doodle-ideas-page";
import { getGalleryItems } from "@/lib/gallery-catalog";
import { SUPPORTED_LOCALES } from "@/lib/i18n";
import { ARTICLE_SLUGS, getEditorialPath } from "@/lib/editorial";

describe("server-rendered discovery", () => {
  it.each(SUPPORTED_LOCALES)("renders all localized %s examples and article links", locale => {
    const page = new DOMParser().parseFromString(renderToStaticMarkup(<DoodleIdeasPage locale={locale} />), "text/html");
    const cards = [...page.querySelectorAll("article")];
    expect(cards).toHaveLength(31);
    getGalleryItems(locale).forEach((item, index) => {
      expect(cards[index].querySelector("img")?.getAttribute("alt")).toBe(item.caption);
      expect(cards[index].querySelector("img")?.getAttribute("src")).toBe(`${item.thumbnail}-320.webp`);
      expect(cards[index].querySelector("a")).toBeNull();
    });
    expect(page.querySelectorAll('img[loading="eager"]')).toHaveLength(2);
    expect(page.querySelectorAll('article img[loading="lazy"]')).toHaveLength(29);
    expect(page.querySelector(".quick-ideas, .ideas-guide")).toBeNull();
    for (const slug of ARTICLE_SLUGS) expect(page.querySelector(`footer a[href="${getEditorialPath(locale, "blog", slug)}"]`)).not.toBeNull();
    const schema = JSON.parse(page.querySelector('script[type="application/ld+json"]')!.textContent!);
    expect(schema.mainEntity.itemListElement).toHaveLength(31);
  });
});
