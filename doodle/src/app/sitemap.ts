import type { MetadataRoute } from "next";
import { SITE_URL, SUPPORTED_LOCALES, getLanguageAlternates, localePath } from "@/lib/i18n";

export default function sitemap(): MetadataRoute.Sitemap {
  return SUPPORTED_LOCALES.map((locale) => ({
    url: `${SITE_URL}${localePath(locale)}`,
    changeFrequency: "monthly",
    priority: locale === "en" ? 1 : 0.9,
    alternates: { languages: getLanguageAlternates() },
    images: [`${SITE_URL}/references/doodle-reference-kiss.png`],
  }));
}
