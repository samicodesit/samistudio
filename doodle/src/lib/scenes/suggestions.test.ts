import { describe, expect, it } from "vitest";
import {
  SCENE_IDEAS,
  SCENE_SUGGESTIONS,
  pickSceneIdeas,
  pickSuggestions,
  localizeSceneIdeas,
} from "./suggestions";
import { getCopy, SUPPORTED_LOCALES } from "@/lib/i18n";

describe("suggestions", () => {
  it("contains exactly 50 unique approved scenes with stable IDs", () => {
    expect(SCENE_IDEAS).toHaveLength(50);
    expect(SCENE_SUGGESTIONS).toHaveLength(50);
    expect(new Set(SCENE_IDEAS.map((idea) => idea.id)).size).toBe(50);
    expect(new Set(SCENE_IDEAS.map((idea) => idea.prompt)).size).toBe(50);
  });

  it("selects three distinct suggestions", () => {
    const result = pickSuggestions(() => 0.25);
    expect(result).toHaveLength(3);
    expect(new Set(result).size).toBe(3);
    expect(result.every((scene) => (SCENE_SUGGESTIONS as readonly string[]).includes(scene))).toBe(true);
  });

  it("returns localized prompts while preserving the selected stable IDs", () => {
    const prompts = SCENE_IDEAS.map((_, index) => `translated scene ${index}`);
    const result = pickSceneIdeas({ prompts, random: () => 0.25 });

    expect(result).toHaveLength(3);
    expect(result.every((idea) => idea.prompt.startsWith("translated scene "))).toBe(true);
    expect(result.every((idea) => SCENE_IDEAS.some((candidate) => candidate.id === idea.id))).toBe(true);
  });

  it("avoids the previous three IDs when enough other ideas remain", () => {
    const previous = SCENE_IDEAS.slice(0, 3).map((idea) => idea.id);
    const result = pickSceneIdeas({ random: () => 0.25, recentIds: previous });

    expect(result).toHaveLength(3);
    expect(result.every((idea) => !previous.includes(idea.id))).toBe(true);
  });

  it("falls back to the full bank when fewer than three candidates remain", () => {
    const recentIds = SCENE_IDEAS.slice(0, 48).map((idea) => idea.id);
    const result = pickSceneIdeas({ random: () => 0.25, recentIds });

    expect(result).toHaveLength(3);
    expect(new Set(result.map((idea) => idea.id)).size).toBe(3);
  });

  it("localizes an existing selection without changing its IDs", () => {
    const ids = SCENE_IDEAS.slice(0, 3).map((idea) => idea.id);
    const prompts = SCENE_IDEAS.map((_, index) => `locale scene ${index}`);

    expect(localizeSceneIdeas(ids, prompts)).toEqual([
      { id: ids[0], prompt: "locale scene 0" },
      { id: ids[1], prompt: "locale scene 1" },
      { id: ids[2], prompt: "locale scene 2" },
    ]);
  });

  it.each(SUPPORTED_LOCALES)("has 50 localized prompts for %s", (locale) => {
    const prompts = getCopy(locale).suggestions.items;

    expect(prompts).toHaveLength(50);
    expect(new Set(prompts).size).toBe(50);
    expect(prompts.every((prompt) => prompt.trim().length > 0)).toBe(true);
  });
});
