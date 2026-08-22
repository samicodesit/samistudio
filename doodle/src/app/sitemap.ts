import type { MetadataRoute } from "next";
import { SITE_URL, SUPPORTED_LOCALES, getLanguageAlternates, htmlLang, localePath } from "@/lib/i18n";
import { IDEA_IMAGES, ideasPath } from "@/lib/doodle-ideas";

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
    ...["privacy", "terms", "refund", "contact"].map((page) => ({
      url: `${SITE_URL}/${page}`,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
