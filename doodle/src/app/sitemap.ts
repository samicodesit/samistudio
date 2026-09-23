import type { MetadataRoute } from "next";
import { SITE_URL, SUPPORTED_LOCALES, getLanguageAlternates, htmlLang, localePath } from "@/lib/i18n";
import { IDEA_IMAGES, ideasPath } from "@/lib/doodle-ideas";
import { ARTICLE_SLUGS, getEditorialAlternates, getEditorialPath } from "@/lib/editorial";

export default function sitemap(): MetadataRoute.Sitemap {
  const localizedPages: MetadataRoute.Sitemap = SUPPORTED_LOCALES.map((locale) => ({
    url: `${SITE_URL}${localePath(locale)}`,
    changeFrequency: "monthly",
    priority: locale === "en" ? 1 : 0.9,
    alternates: { languages: getLanguageAlternates() },
    images: [`${SITE_URL}/references/doodle-reference-kiss.png`],
  }));

  return [
    ...localizedPages,
    ...SUPPORTED_LOCALES.map((locale) => ({
      url: `${SITE_URL}${ideasPath(locale)}`,
      changeFrequency: "monthly" as const,
      priority: locale === "en" ? 0.8 : 0.7,
      alternates: { languages: Object.fromEntries([...SUPPORTED_LOCALES.map((item) => [htmlLang(item), `${SITE_URL}${ideasPath(item)}`]), ["x-default", `${SITE_URL}${ideasPath("en")}`]]) },
      images: IDEA_IMAGES.map((image) => `${SITE_URL}${image}`),
    })),
    ...SUPPORTED_LOCALES.flatMap((locale) => [
      {
        url: `${SITE_URL}${getEditorialPath(locale, "blog")}`,
        changeFrequency: "monthly" as const,
        priority: locale === "en" ? 0.8 : 0.7,
        alternates: { languages: getEditorialAlternates("blog") },
      },
      ...ARTICLE_SLUGS.map((slug) => ({
        url: `${SITE_URL}${getEditorialPath(locale, "blog", slug)}`,
        changeFrequency: "monthly" as const,
        priority: locale === "en" ? 0.7 : 0.6,
        alternates: { languages: getEditorialAlternates("blog", slug) },
      })),
      {
        url: `${SITE_URL}${getEditorialPath(locale, "for-ai")}`,
        changeFrequency: "monthly" as const,
        priority: locale === "en" ? 0.7 : 0.6,
        alternates: { languages: getEditorialAlternates("for-ai") },
      },
    ]),
    ...["privacy", "terms", "refund", "contact"].map((page) => ({
      url: `${SITE_URL}/${page}`,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
