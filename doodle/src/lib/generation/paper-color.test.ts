// @vitest-environment node
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { correctPaperColor } from "./paper-color";

async function fixture(paper = [245, 219, 144], marking = [45, 43, 32, 255]) {
  const pixels = Buffer.alloc(1024 * 1024 * 4);
  for (let i = 0; i < pixels.length; i += 4) pixels.set([...paper, 255], i);
  // A small solid ink area also tests alpha and colored-content protection.
  for (let y = 400; y < 450; y++) for (let x = 400; x < 450; x++) pixels.set(marking, (y * 1024 + x) * 4);
  return sharp(pixels, { raw: { width: 1024, height: 1024, channels: 4 } }).png().toBuffer();
}
afterEach(() => vi.unstubAllEnvs());

describe("paper color correction", () => {
  it("reaches the target paper color without altering dark ink or dimensions", async () => {
    const input = await fixture();
    const result = await correctPaperColor(input);
    const { data, info } = await sharp(result.bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(result.metadata.status).toBe("corrected");
    expect([info.width, info.height]).toEqual([1024, 1024]);
    expect([...data.subarray(0, 4)]).toEqual([255, 235, 138, 255]);
    expect([...data.subarray((420 * 1024 + 420) * 4, (420 * 1024 + 420) * 4 + 4)]).toEqual([45, 43, 32, 255]);
  });

  it("returns already-correct paper byte-for-byte without re-encoding", async () => {
    const input = await fixture([255, 235, 138]);
    const result = await correctPaperColor(input);
    expect(result.bytes).toBe(input);
    expect(result.metadata.status).toBe("unchanged");
  });

  it("fades the adjustment at lighter ink instead of applying the full paper shift", async () => {
    const input = await fixture([245, 219, 144], [160, 145, 100, 255]);
    const result = await correctPaperColor(input);
    const pixels = await sharp(result.bytes).ensureAlpha().raw().toBuffer();
    expect(result.metadata.status).toBe("corrected");
    expect([...pixels.subarray((420 * 1024 + 420) * 4, (420 * 1024 + 420) * 4 + 4)]).toEqual([162, 148, 99, 255]);
  });

  it.each([
    { label: "blue paper", paper: [120, 160, 230], marking: [45, 43, 32, 255] },
    { label: "excessive drift", paper: [230, 185, 70], marking: [45, 43, 32, 255] },
    { label: "colored foreground", paper: [245, 219, 144], marking: [220, 50, 50, 255] },
    { label: "transparent drawing", paper: [245, 219, 144], marking: [45, 43, 32, 128] },
  ])("preserves the original for $label", async ({ paper, marking }) => {
    const input = await fixture(paper, marking);
    const result = await correctPaperColor(input);
    expect(result.bytes).toBe(input);
    expect(result.metadata.status).toBe("uncertain");
  });

  it("does not force a broad paper gradient to a single target", async () => {
    const pixels = Buffer.alloc(1024 * 1024 * 3);
    for (let y = 0; y < 1024; y++) for (let x = 0; x < 1024; x++) pixels.set([245, 175 + Math.round(y / 1024 * 65), 110], (y * 1024 + x) * 3);
    const input = await sharp(pixels, { raw: { width: 1024, height: 1024, channels: 3 } }).png().toBuffer();
    const result = await correctPaperColor(input);
    expect(result.bytes).toBe(input);
    expect(result.metadata.status).toBe("uncertain");
  });

  it("limits unexpected input dimensions and file sizes before correction", async () => {
    const small = await sharp({ create: { width: 16, height: 16, channels: 3, background: "#F5DB90" } }).png().toBuffer();
    for (const input of [small, Buffer.alloc(8 * 1024 * 1024 + 1)]) {
      const result = await correctPaperColor(input);
      expect(result.bytes).toBe(input);
      expect(result.metadata.status).toBe("unsupported");
    }
  });

  it("passes grayscale PNGs through without assuming they have RGB pixels", async () => {
    const input = await sharp(await fixture()).toColourspace("b-w").png().toBuffer();
    const result = await correctPaperColor(input);
    expect(result.bytes).toBe(input);
    expect(result.metadata.status).toBe("unsupported");
  });

  it("returns malformed bytes unchanged without leaking an error", async () => {
    const input = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const result = await correctPaperColor(input);
    expect(result.bytes).toBe(input);
    expect(result.metadata.status).toBe("error");
    expect(Object.keys(result.metadata).sort()).toEqual(["durationMs", "status", "version"]);
  });

  it("returns the generated image even if image processing fails", async () => {
    const input = await fixture();
    vi.spyOn(sharp.prototype, "metadata").mockRejectedValueOnce(new Error("private provider content"));
    const result = await correctPaperColor(input);
    expect(result.bytes).toBe(input);
    expect(result.metadata.status).toBe("error");
    expect(JSON.stringify(result.metadata)).not.toContain("private");
  });

  it("keeps the original intact when corrected PNG encoding fails", async () => {
    const input = await fixture();
    const backup = Buffer.from(input);
    vi.spyOn(sharp.prototype, "png").mockImplementationOnce(() => { throw new Error("encoding failed"); });
    const result = await correctPaperColor(input);
    expect(result.bytes).toBe(input);
    expect(input.equals(backup)).toBe(true);
    expect(result.metadata.status).toBe("error");
  });

  it("can be disabled without decoding or changing the PNG", async () => {
    vi.stubEnv("DOODLE_PAPER_CORRECTION", "off");
    const input = Buffer.from("undecodable input");
    const result = await correctPaperColor(input);
    expect(result.bytes).toBe(input);
    expect(result.metadata.status).toBe("disabled");
  });

  it.each(["1-1-simple", "1-1-medium", "1-1-detailed", "2-1-simple", "2-1-medium", "2-1-detailed"])("keeps the reviewed appearance and protected ink for %s", async (name) => {
    const root = new URL("../../../", import.meta.url);
    const input = await readFile(new URL(`docs/qa/detail-levels/comparisons/${name}.png`, root));
    const reviewed = await readFile(new URL(`docs/qa/detail-levels/comparisons/paper-color-trial/${name}.png`, root));
    const result = await correctPaperColor(input);
    expect(result.metadata.status).toBe("corrected");
    const before = await sharp(input).ensureAlpha().raw().toBuffer();
    const actual = await sharp(result.bytes).ensureAlpha().raw().toBuffer();
    const accepted = await sharp(reviewed).ensureAlpha().raw().toBuffer();
    expect(actual.equals(accepted)).toBe(true);
    let inkChanged = false, alphaChanged = false;
    for (let i = 0; i < before.length; i += 4) {
      if (Math.max(before[i], before[i + 1], before[i + 2]) < 120 && !before.subarray(i, i + 3).equals(actual.subarray(i, i + 3))) inkChanged = true;
      if (before[i + 3] !== actual[i + 3]) alphaChanged = true;
    }
    expect(inkChanged).toBe(false);
    expect(alphaChanged).toBe(false);
  });
});
