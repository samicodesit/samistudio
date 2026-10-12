import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { getGalleryItems } from "./gallery-catalog";

type AssetManifest = { assets: {
  id: string; detailLevel: string; prompts: { en: string }; captions: { en: string };
  publishedSha256: string; thumbnails: { file: string; sha256: string; width: number }[];
}[] };

describe("approved gallery assets", () => {
  it("matches all originals and thumbnails to the current manifest", async () => {
    // QA records stay out of the deployment upload and are read only by tests.
    const manifest: AssetManifest = JSON.parse(await readFile("docs/qa/gallery-inspiration-2026-10-09/asset-manifest.json", "utf8"));
    const items = getGalleryItems("en");
    expect(manifest.assets).toHaveLength(items.length);
    for (const item of items) {
      const asset = manifest.assets.find(asset => asset.id === item.id)!;
      expect(asset.detailLevel).toBe(item.detailLevel);
      expect(asset.prompts.en).toBe(item.prompt);
      expect(asset.captions.en).toBe(item.caption);
      for (const [file, sha, width] of [
        [item.image, asset.publishedSha256, item.width],
        ...asset.thumbnails.map(thumb => [thumb.file, thumb.sha256, thumb.width]),
      ] as [string, string, number][]) {
        const bytes = await readFile(`public${file}`);
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(sha);
        const image = await sharp(bytes).metadata();
        expect(image.width).toBe(width);
        expect(image.height).toBe(width);
        expect(image.format).toBe("webp");
      }
    }
  });
});
