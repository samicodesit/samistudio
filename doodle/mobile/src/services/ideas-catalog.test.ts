import { expect, it, vi } from "vitest";
import { NativeIdeasCatalog } from "./ideas-catalog";

const item = { id: "flower-cat", image: "/ideas/flower-cat-simple.webp", thumbnail: "/ideas/thumbs/flower-cat-simple-640.webp", prompt: "A cat holding a flower" };
const catalog = { version: 1, locale: "en", items: [item] };

it("shows cached ideas first, then new content, without account or trial credentials", async () => {
  let stored: string | null = JSON.stringify(catalog);
  let requested!: RequestInit;
  const shown: string[][] = [];
  const service = new NativeIdeasCatalog({ baseUrl: "https://doodle.samistudio.nl", cache: {
    read: async () => stored, write: async (_locale, data) => { stored = data; },
  }, fetchImpl: async (url, options) => {
    expect(url).toBe("https://doodle.samistudio.nl/api/ideas?locale=en"); requested = options!;
    return Response.json({ ...catalog, items: [{ ...item, prompt: "A cat with a sunflower" }] });
  } });
  await service.refresh("en", items => shown.push(items.map(x => x.prompt)));
  expect(shown).toEqual([["A cat holding a flower"], ["A cat with a sunflower"]]);
  expect(new Headers(requested.headers).get("authorization")).toBeNull();
  expect(new Headers(requested.headers).get("x-doodle-trial-token")).toBeNull();
  expect(JSON.parse(stored!).items[0].prompt).toBe("A cat with a sunflower");
});

it("keeps the cache when the network fails and delivers nothing when both are unavailable", async () => {
  let cached: string | null = JSON.stringify(catalog);
  const seen: unknown[] = [];
  const service = new NativeIdeasCatalog({ baseUrl: "https://doodle.samistudio.nl", cache: { read: async () => cached, write: async () => {} }, fetchImpl: async () => { throw new Error("Offline"); } });
  await service.refresh("en", items => seen.push(items));
  expect(seen).toEqual([[item]]);
  cached = null; seen.length = 0;
  await service.refresh("en", items => seen.push(items));
  expect(seen).toEqual([]);
});

it.each([
  { ...catalog, locale: "nl" }, { ...catalog, version: 2 },
  { ...catalog, items: [{ ...item, image: "https://other.example/image.webp" }] },
  { ...catalog, items: [{ ...item, thumbnail: "/ideas/../private.webp" }] },
  { ...catalog, items: [{ ...item, prompt: "x".repeat(181) }] },
  { ...catalog, items: [item, item] }, { ...catalog, items: [] },
])( "rejects invalid remote or cached catalogs without replacing bundled ideas: %j", async bad => {
  const shown = vi.fn();
  const service = new NativeIdeasCatalog({ baseUrl: "https://doodle.samistudio.nl", cache: { read: async () => JSON.stringify(bad), write: async () => {} }, fetchImpl: async () => Response.json(bad) });
  await service.refresh("en", shown);
  expect(shown).not.toHaveBeenCalled();
});

it("still displays fresh ideas if device caching fails", async () => {
  const shown = vi.fn();
  const service = new NativeIdeasCatalog({ baseUrl: "https://doodle.samistudio.nl", cache: { read: async () => { throw new Error("Disk"); }, write: async () => { throw new Error("Disk"); } }, fetchImpl: async () => Response.json(catalog) });
  await service.refresh("en", shown);
  expect(shown).toHaveBeenCalledWith([item]);
});
