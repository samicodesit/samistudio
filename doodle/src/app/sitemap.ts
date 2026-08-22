import type { MetadataRoute } from "next";
import { SITE_URL, SUPPORTED_LOCALES, getLanguageAlternates, localePath } from "@/lib/i18n";
import { DOODLE_IDEAS } from "@/lib/doodle-ideas";

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
    {
      url: `${SITE_URL}/doodle-ideas`,
      changeFrequency: "monthly",
      priority: 0.8,
      images: DOODLE_IDEAS.map(({ image }) => `${SITE_URL}${image}`),
    },
    ...["privacy", "terms", "refund", "contact"].map((page) => ({
      url: `${SITE_URL}/${page}`,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
