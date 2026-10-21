// @vitest-environment node
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { PAPER_COLORS, type PaperColorId } from "./paper-colors";
import { DETAIL_LEVELS } from "./detail-level";
import { generationProfile } from "./profile";
import { buildDoodlePrompt } from "./prompt";
import { buildPhotoPrompt } from "./photo-prompt";
import { correctPaperColor } from "./paper-color";
describe("selected paper generation", () => {
  for (const color of PAPER_COLORS) for (const level of DETAIL_LEVELS) it(`${color.id} ${level} text and photo instructions`, () => {
    const text = buildDoodlePrompt("a yellow bird", generationProfile(level), color.id);
    const photo = buildPhotoPrompt(level, color.id);
    expect(text).toContain(color.hex); expect(photo).toContain(color.hex);
    expect(text).toContain("<scene>a yellow bird</scene>");
    expect(photo).toContain("PHOTO CONVERSION CONTRACT");
    if (color.id !== "yellow") { expect(text.split("<scene>")[0]).not.toContain("yellow"); expect(photo).not.toContain("yellow"); }
  });
  it.each(PAPER_COLORS)("corrects $id paper while preserving dark ink", async color => {
    const rgb = color.hex.slice(1).match(/../g)!.map(c => parseInt(c,16));
    const drift = rgb.map(c => c - 8);
    const raw = Buffer.alloc(1024*1024*3);
    for(let i=0;i<raw.length;i+=3) raw.set(drift,i);
    raw.set([40,40,40],0);
    const input = await sharp(raw,{raw:{width:1024,height:1024,channels:3}}).png().toBuffer();
    const result = await correctPaperColor(input,color.id);
    const actual = await sharp(result.bytes).removeAlpha().raw().toBuffer();
    expect(result.metadata.status).toBe("corrected"); expect([...actual.subarray(0,3)]).toEqual([40,40,40]);
    expect([...actual.subarray(3,6)]).toEqual(rgb);
  });
});

it("requests neutral white paper without contradictory pastel or not-white instructions", () => {
  for (const level of DETAIL_LEVELS) {
    for (const prompt of [buildDoodlePrompt("a yellow bird", generationProfile(level), "white" as PaperColorId), buildPhotoPrompt(level, "white" as PaperColorId)]) {
      expect(prompt).toContain("#FFFFFF");
      expect(prompt).toContain("clean neutral white");
      expect(prompt).not.toContain("not white");
      expect(prompt).not.toContain("pastel white");
    }
  }
});
it("normalizes neutral white paper without changing dark linework", async () => {
  const raw = Buffer.alloc(1024 * 1024 * 3, 247);
  raw.set([40, 40, 40], 0);
  const input = await sharp(raw, { raw: { width: 1024, height: 1024, channels: 3 } }).png().toBuffer();
  const result = await correctPaperColor(input, "white" as PaperColorId);
  expect(result.metadata.status).toBe("corrected");
  const actual = await sharp(result.bytes).removeAlpha().raw().toBuffer();
  expect([...actual.subarray(0, 6)]).toEqual([40, 40, 40, 255, 255, 255]);
});
