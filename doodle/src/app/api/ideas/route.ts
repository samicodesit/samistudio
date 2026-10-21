import { getGalleryItems } from "@/lib/gallery-catalog";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n";

export function GET(request: Request): Response {
  const locale = new URL(request.url).searchParams.get("locale") ?? "en";
  if (!SUPPORTED_LOCALES.includes(locale as Locale)) return Response.json({ error: "invalid_locale" }, { status: 400 });
  const items = getGalleryItems(locale as Locale).filter(item => item.detailLevel === "simple").map(item => ({
    id: item.id, image: item.image, thumbnail: `${item.thumbnail}-640.webp`, prompt: item.prompt,
  }));
  return Response.json({ version: 1, locale, items }, {
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
