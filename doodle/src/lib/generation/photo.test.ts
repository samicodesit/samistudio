import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { normalizePhoto, PhotoValidationError } from "./photo";

describe("photo upload validation", () => {
  it("rejects non-image bytes and noncanonical base64", async () => {
    await expect(normalizePhoto(Buffer.from("not a photo").toString("base64"))).rejects.toBeInstanceOf(PhotoValidationError);
    await expect(normalizePhoto("!!!!")).rejects.toBeInstanceOf(PhotoValidationError);
  });

  it("rejects oversized payloads before decoding", async () => {
    await expect(normalizePhoto("A".repeat(800_000))).rejects.toBeInstanceOf(PhotoValidationError);
  });

  it("strips location metadata, preserves aspect ratio and bounds provider input", async () => {
    const input = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "red" } })
      .jpeg().withExif({ IFD0: { Artist: "private person" } }).toBuffer();
    const photo = await normalizePhoto(input.toString("base64"));
    const metadata = await sharp(photo).metadata();
    expect(metadata.width).toBe(600);
    expect(metadata.height).toBe(400);
    expect(metadata.exif).toBeUndefined();
    expect(metadata.format).toBe("jpeg");
  });

  it("rejects unsupported formats rather than forwarding arbitrary uploads", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
    await expect(normalizePhoto(svg.toString("base64"))).rejects.toBeInstanceOf(PhotoValidationError);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])("applies EXIF orientation %s exactly once", async orientation => {
    const pixels = Buffer.alloc(80 * 40 * 3);
    for (let y = 0; y < 40; y++) for (let x = 0; x < 80; x++) {
      const offset = (y * 80 + x) * 3;
      pixels[offset] = x < 40 ? 255 : 0; pixels[offset + 1] = y < 20 ? 255 : 0; pixels[offset + 2] = x >= 40 ? 255 : 0;
    }
    const input = await sharp(pixels, { raw: { width: 80, height: 40, channels: 3 } }).withMetadata({ orientation }).jpeg().toBuffer();
    const output = await normalizePhoto(input.toString("base64"));
    const actual = await sharp(output).raw().toBuffer({ resolveWithObject: true });
    expect(actual.info.width).toBe(orientation >= 5 ? 40 : 80);
    expect(actual.info.height).toBe(orientation >= 5 ? 80 : 40);
    const colors = { yellow: [255, 255, 0], cyan: [0, 255, 255], red: [255, 0, 0], blue: [0, 0, 255] };
    const corners: (keyof typeof colors)[][] = [
      ["yellow", "cyan", "red", "blue"], ["cyan", "yellow", "blue", "red"],
      ["blue", "red", "cyan", "yellow"], ["red", "blue", "yellow", "cyan"],
      ["yellow", "red", "cyan", "blue"], ["red", "yellow", "blue", "cyan"],
      ["blue", "cyan", "red", "yellow"], ["cyan", "blue", "yellow", "red"],
    ];
    const { width, height, channels } = actual.info;
    [[5, 5], [width - 6, 5], [5, height - 6], [width - 6, height - 6]].forEach(([x, y], corner) => {
      const offset = (y * width + x) * channels;
      colors[corners[orientation - 1][corner]].forEach((expected, channel) => expect(Math.abs(actual.data[offset + channel] - expected)).toBeLessThan(20));
    });
    expect((await sharp(output).metadata()).orientation).toBeUndefined();
  });

  it.each([[100, 200, 100, 200], [200, 100, 200, 100], [20, 2400, 5, 600], [2400, 20, 600, 5]])("fits %sx%s without cropping or enlargement", async (width, height, expectedWidth, expectedHeight) => {
    const input = await sharp({ create: { width, height, channels: 3, background: "red" } }).png().toBuffer();
    const metadata = await sharp(await normalizePhoto(input.toString("base64"))).metadata();
    expect([metadata.width, metadata.height]).toEqual([expectedWidth, expectedHeight]);
  });

  it.each(["png", "webp"] as const)("composites transparent %s images onto white", async format => {
    const input = await sharp({ create: { width: 30, height: 20, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })[format]().toBuffer();
    const output = await normalizePhoto(input.toString("base64"));
    const { data, info } = await sharp(output).raw().toBuffer({ resolveWithObject: true });
    expect(info.channels).toBe(3);
    expect([...data.slice(0, 3)]).toEqual([255, 255, 255]);
  });

  it("rejects a truncated image and a compressed image above the pixel limit", async () => {
    const jpeg = await sharp({ create: { width: 8000, height: 4000, channels: 3, background: "red" } }).jpeg().toBuffer();
    expect(jpeg.length).toBeLessThan(512_000);
    await expect(normalizePhoto(jpeg.toString("base64"))).rejects.toBeInstanceOf(PhotoValidationError);
    await expect(normalizePhoto(jpeg.subarray(0, 300).toString("base64"))).rejects.toBeInstanceOf(PhotoValidationError);
  });

  it("converts CMYK input to ordinary RGB without keeping metadata", async () => {
    const input = await sharp({ create: { width: 20, height: 20, channels: 3, background: "red" } }).toColourspace("cmyk").jpeg().toBuffer();
    const photo = await normalizePhoto(input.toString("base64"));
    const metadata = await sharp(photo).metadata();
    expect(metadata.space).toBe("srgb");
    expect(metadata.channels).toBe(3);
    expect(metadata.icc).toBeUndefined();
  });

  it("rejects animated WebP instead of sending multiple frames to the provider", async () => {
    const frames = await Promise.all(["red", "blue"].map(background => sharp({ create: { width: 20, height: 20, channels: 3, background } }).png().toBuffer()));
    const input = await sharp(frames, { join: { animated: true } }).webp({ loop: 0, delay: [100, 100] }).toBuffer();
    expect((await sharp(input).metadata()).pages).toBe(2);
    await expect(normalizePhoto(input.toString("base64"))).rejects.toBeInstanceOf(PhotoValidationError);
  });
});
