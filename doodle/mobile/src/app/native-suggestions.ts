import { localizeSceneIdeas, pickSceneIdeas, type SceneIdeaId } from "../../../src/lib/scenes/suggestions";

export function pickNativeSuggestionIds(
  prompts: readonly string[],
  recentIds: readonly SceneIdeaId[] = [],
  random: () => number = Math.random,
): readonly SceneIdeaId[] {
  return pickSceneIdeas({ prompts, recentIds, random }).map((idea) => idea.id);
}

export function localizeNativeSuggestionPrompts(
  ids: readonly SceneIdeaId[],
  prompts: readonly string[],
): readonly string[] {
  return localizeSceneIdeas(ids, prompts).map((idea) => idea.prompt);
}
