import type { Locale } from "./i18n";
import type { DetailLevel } from "./generation/detail-level";
import catalog from "./gallery-assets.json";
import { getGalleryCaption, getNewGalleryPrompt, type GallerySubject } from "./gallery-copy";

export type GalleryItem = {
  id: string; image: string; thumbnail: string; width: number; height: number;
  detailLevel: DetailLevel; caption: string; prompt: string;
};

export function getGalleryItems(locale: Locale): GalleryItem[] {
  return catalog.map(item => ({
    id: item.id, image: item.image, thumbnail: item.thumbnail,
    width: item.width, height: item.height, detailLevel: item.detailLevel as DetailLevel,
    caption: getGalleryCaption(locale, item.subject as GallerySubject),
    prompt: item.prompts ? item.prompts[locale] : getNewGalleryPrompt(locale, item.subject as Parameters<typeof getNewGalleryPrompt>[1]),
  }));
}
