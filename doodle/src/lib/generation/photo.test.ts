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
});
