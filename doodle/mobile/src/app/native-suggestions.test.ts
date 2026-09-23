import { describe, expect, it } from "vitest";
import { SCENE_IDEAS, SCENE_SUGGESTIONS } from "../../../src/lib/scenes/suggestions";
import { localizeNativeSuggestionPrompts, pickNativeSuggestionIds } from "./native-suggestions";

describe("native composer suggestions", () => {
  it("selects three unique ideas and rerolls away from the previous set", () => {
    const first = pickNativeSuggestionIds(SCENE_SUGGESTIONS, [], () => 0.17);
    const next = pickNativeSuggestionIds(SCENE_SUGGESTIONS, first, () => 0.83);

    expect(first).toHaveLength(3);
    expect(new Set(first).size).toBe(3);
    expect(next).toHaveLength(3);
    expect(new Set(next).size).toBe(3);
    expect(next.some((id) => first.includes(id))).toBe(false);
  });

  it("uses the exact prompt text for the active locale bank", () => {
    const ids = pickNativeSuggestionIds(SCENE_SUGGESTIONS, [], () => 0.42);
    const localized = localizeNativeSuggestionPrompts(ids, SCENE_SUGGESTIONS);

    expect(localized).toEqual(ids.map((id) => SCENE_IDEAS.find((idea) => idea.id === id)!.prompt));
  });
});
