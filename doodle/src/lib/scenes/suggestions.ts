type SceneIdeaDefinition = {
  readonly id: string;
  readonly prompt: string;
};

export const SCENE_IDEAS = [
  { id: "friends-baking-pancakes", prompt: "Two friends baking pancakes" },
  { id: "astronaut-resting-moon", prompt: "A sleepy astronaut resting on the moon" },
  { id: "grandparent-teaching-fishing", prompt: "A grandparent teaching a child to fish" },
  { id: "cat-raincoat-sharing-umbrella", prompt: "A cat in a raincoat sharing an umbrella with a tiny bird" },
  { id: "dog-flower-for-cat", prompt: "A dog offering a small flower to a cat" },
  { id: "siblings-blanket-fort", prompt: "Two siblings building a blanket fort" },
  { id: "person-steaming-mug", prompt: "A person warming both hands around a steaming mug" },
  { id: "child-running-kite", prompt: "A child running with a kite" },
  { id: "upside-down-cat-kiss", prompt: "Two cats recreating an upside-down superhero kiss" },
  { id: "tiny-chef-soup-pot", prompt: "A tiny chef stirring a giant soup pot" },
  { id: "bear-bedtime-rabbit", prompt: "A bear reading a bedtime story to a rabbit" },
  { id: "couple-kitchen-dance", prompt: "A couple dancing in the kitchen" },
  { id: "penguin-birthday-cake", prompt: "A penguin carrying a birthday cake" },
  { id: "parent-tying-shoelace", prompt: "A parent tying a child's shoelace" },
  { id: "friends-silly-selfie", prompt: "Two friends taking a silly selfie" },
  { id: "cat-watering-flowers", prompt: "A cat watering three small flowers" },
  { id: "dog-under-desk", prompt: "A dog sleeping under a desk" },
  { id: "warm-scarf-gift", prompt: "A person giving someone a warm scarf" },
  { id: "children-puddle-jump", prompt: "Two children jumping in one puddle" },
  { id: "rabbit-painting-picture", prompt: "A rabbit painting a tiny picture" },
  { id: "superhero-breakfast", prompt: "A superhero making breakfast" },
  { id: "train-window-wave", prompt: "A person waving from a train window" },
  { id: "friends-sharing-headphones", prompt: "Two friends sharing one pair of headphones" },
  { id: "cat-falling-leaf", prompt: "A cat reaching for a falling leaf" },
  { id: "child-teddy-hug", prompt: "A child hugging a large teddy bear" },
  { id: "couple-rooftop-stars", prompt: "A couple watching stars from a rooftop" },
  { id: "dog-picnic-basket", prompt: "A dog waiting beside a picnic basket" },
  { id: "person-planting-tree", prompt: "A person planting a small tree" },
  { id: "birds-building-nest", prompt: "Two birds building a nest together" },
  { id: "baker-perfect-cupcake", prompt: "A baker presenting one perfect cupcake" },
  { id: "child-snail-crossing", prompt: "A child helping a snail cross a path" },
  { id: "friends-board-game", prompt: "Two friends playing a board game" },
  { id: "cat-open-book", prompt: "A cat sleeping on an open book" },
  { id: "person-groceries-rain", prompt: "A person carrying groceries in the rain" },
  { id: "ghost-hot-chocolate", prompt: "A tiny ghost drinking hot chocolate" },
  { id: "dog-party-hat", prompt: "A dog wearing a party hat" },
  { id: "child-heart-letter", prompt: "A child mailing a heart-shaped letter" },
  { id: "puzzle-high-five", prompt: "Two people high-fiving after finishing a puzzle" },
  { id: "rabbit-lantern", prompt: "A rabbit holding a lantern at night" },
  { id: "person-robot-dance", prompt: "A person teaching a robot to dance" },
  { id: "cat-dog-windowsill", prompt: "A cat and dog sharing a sunny windowsill" },
  { id: "child-snow-angel", prompt: "A child making a snow angel" },
  { id: "fox-thank-you-note", prompt: "A little fox carrying a thank-you note" },
  { id: "frog-leaf-reading", prompt: "A frog reading under a leaf" },
  { id: "mouse-cookie-sharing", prompt: "A mouse sharing a cookie with a friend" },
  { id: "sun-star-bedtime", prompt: "A sun tucking a star into bed" },
  { id: "duck-paper-boat", prompt: "A duck paddling beside a paper boat" },
  { id: "child-notebook-sticker", prompt: "A child placing a sticker on a notebook" },
  { id: "rabbit-gift-ribbon", prompt: "A rabbit tying a ribbon around a gift" },
  { id: "koala-lunchbox-wave", prompt: "A koala waving from a lunchbox" },
] as const satisfies readonly SceneIdeaDefinition[];

export type SceneIdeaId = (typeof SCENE_IDEAS)[number]["id"];

export type SceneIdea = {
  readonly id: SceneIdeaId;
  readonly prompt: string;
};

export const SCENE_SUGGESTIONS = SCENE_IDEAS.map((idea) => idea.prompt);

export const DEFAULT_SUGGESTION_IDS = [
  "warm-scarf-gift",
  "couple-kitchen-dance",
  "dog-party-hat",
] as const satisfies readonly SceneIdeaId[];

export interface SceneSelectionOptions {
  readonly prompts?: readonly string[];
  readonly random?: () => number;
  readonly recentIds?: readonly SceneIdeaId[];
}

type IndexedSceneIdea = {
  readonly idea: (typeof SCENE_IDEAS)[number];
  readonly index: number;
};

function safeRandomValue(random: () => number): number {
  const value = random();
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 0.999999) : 0;
}

function localizedIdea(item: IndexedSceneIdea, prompts: readonly string[]): SceneIdea {
  return {
    id: item.idea.id,
    prompt: prompts[item.index] ?? item.idea.prompt,
  };
}

export function pickSceneIdeas(
  { prompts = SCENE_SUGGESTIONS, random = Math.random, recentIds = [] }: SceneSelectionOptions = {},
): readonly [SceneIdea, SceneIdea, SceneIdea] {
  const recent = new Set(recentIds);
  const all = SCENE_IDEAS.map((idea, index) => ({ idea, index }));
  const preferred = all.filter((item) => !recent.has(item.idea.id));
  const shuffled = [...(preferred.length >= 3 ? preferred : all)];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(safeRandomValue(random) * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return [
    localizedIdea(shuffled[0], prompts),
    localizedIdea(shuffled[1], prompts),
    localizedIdea(shuffled[2], prompts),
  ];
}

export function localizeSceneIdeas(
  ids: readonly SceneIdeaId[],
  prompts: readonly string[] = SCENE_SUGGESTIONS,
): readonly SceneIdea[] {
  return ids.flatMap((id) => {
    const index = SCENE_IDEAS.findIndex((idea) => idea.id === id);
    return index < 0 ? [] : [localizedIdea({ idea: SCENE_IDEAS[index], index }, prompts)];
  });
}

export function pickSuggestions(
  random: () => number = Math.random,
  recentIds: readonly SceneIdeaId[] = [],
): readonly [string, string, string] {
  return pickSceneIdeas({ random, recentIds }).map((idea) => idea.prompt) as [string, string, string];
}
