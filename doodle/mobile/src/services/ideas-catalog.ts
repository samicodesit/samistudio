import type { NativeLocale } from "../ui/types";

export interface CatalogIdea { id: string; image: string; thumbnail: string; prompt: string }
export interface IdeasCache {
  read(locale: NativeLocale): Promise<string | null>;
  write(locale: NativeLocale, data: string): Promise<void>;
}
const IMAGE = /^\/ideas\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.webp$/;

function parse(raw: string, locale: NativeLocale): CatalogIdea[] | null {
  if (raw.length > 131_072) return null;
  try {
    const value = JSON.parse(raw);
    if (value.version !== 1 || value.locale !== locale || !Array.isArray(value.items) || !value.items.length || value.items.length > 64) return null;
    const ids = new Set<string>();
    const items: CatalogIdea[] = [];
    for (const item of value.items) {
      if (!item || typeof item.id !== "string" || !/^[a-z0-9-]{1,64}$/.test(item.id) || ids.has(item.id) ||
          typeof item.prompt !== "string" || !item.prompt.trim() || [...item.prompt].length > 180 ||
          typeof item.image !== "string" || !IMAGE.test(item.image) ||
          typeof item.thumbnail !== "string" || !IMAGE.test(item.thumbnail)) return null;
      ids.add(item.id);
      items.push({ id: item.id, image: item.image, thumbnail: item.thumbnail, prompt: item.prompt });
    }
    return items;
  } catch { return null; }
}

export class NativeIdeasCatalog {
  constructor(private readonly options: { baseUrl: string; cache: IdeasCache; fetchImpl?: typeof fetch }) {}

  async refresh(locale: NativeLocale, show: (items: CatalogIdea[]) => void): Promise<void> {
    try {
      const cached = await this.options.cache.read(locale);
      const items = cached && parse(cached, locale);
      if (items) show(items);
    } catch { /* Bundled ideas remain available. */ }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const url = new URL("/api/ideas", this.options.baseUrl);
      url.searchParams.set("locale", locale);
      const response = await (this.options.fetchImpl ?? fetch)(url.toString(), {
        headers: { Accept: "application/json" }, credentials: "omit", signal: controller.signal,
      });
      if (!response.ok) return;
      const items = parse(await response.text(), locale);
      if (!items) return;
      show(items);
      await this.options.cache.write(locale, JSON.stringify({ version: 1, locale, items }));
    } catch { /* Network or cache failures must not block browsing. */ }
    finally { clearTimeout(timeout); }
  }
}
