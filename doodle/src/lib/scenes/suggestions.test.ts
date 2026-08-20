import { describe, expect, it } from "vitest";
import { SCENE_SUGGESTIONS, pickSuggestions } from "./suggestions";

describe("suggestions", () => {
  it("contains exactly 42 approved scenes", () => expect(SCENE_SUGGESTIONS).toHaveLength(42));

  it("selects three distinct suggestions", () => {
    const result = pickSuggestions(() => 0.25);
    expect(result).toHaveLength(3);
    expect(new Set(result).size).toBe(3);
    expect(result.every((scene) => (SCENE_SUGGESTIONS as readonly string[]).includes(scene))).toBe(true);
  });
});
