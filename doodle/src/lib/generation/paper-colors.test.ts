import { describe, expect, it } from "vitest";
import { PAPER_COLORS, isPaperColorId, storedPaperColor } from "./paper-colors";
import { getPaperColorCopy } from "../paper-color-copy";
import { SUPPORTED_LOCALES } from "../i18n";
describe("paper presets", () => {
  it("shares seven stable preset IDs and sRGB targets", () => {
    expect(PAPER_COLORS.map(p => [p.id, p.hex])).toEqual([["yellow","#FFEB8A"],["pink","#F5BDD2"],["peach","#FFD0A6"],["mint","#C7E5B7"],["blue","#BCDCF2"],["lavender","#D8C9EE"],["white","#FFFFFF"]]);
    for (const p of PAPER_COLORS) expect(storedPaperColor(p.id)).toBe(p.id);
    for (const bad of [null, undefined, "#FFEB8A", "red", {}, ""]) { expect(isPaperColorId(bad)).toBe(false); expect(storedPaperColor(bad)).toBe("yellow"); }
  });
  it("names every preset in every supported locale", () => {
    for (const locale of SUPPORTED_LOCALES) for (const p of PAPER_COLORS) expect(getPaperColorCopy(locale).colors[p.id]).toBeTruthy();
    expect(getPaperColorCopy("unknown")).toEqual(getPaperColorCopy("en"));
  });
});
