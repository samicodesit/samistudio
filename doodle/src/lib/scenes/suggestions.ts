export const SCENE_SUGGESTIONS = [
  "Two friends baking pancakes",
  "A sleepy astronaut resting on the moon",
  "A grandparent teaching a child to fish",
  "A cat in a raincoat sharing an umbrella with a tiny bird",
  "A dog offering a small flower to a cat",
  "Two siblings building a blanket fort",
  "A person warming both hands around a steaming mug",
  "A child running with a kite",
  "Two cats recreating an upside-down superhero kiss",
  "A tiny chef stirring a giant soup pot",
  "A bear reading a bedtime story to a rabbit",
  "A couple dancing in the kitchen",
  "A penguin carrying a birthday cake",
  "A parent tying a child's shoelace",
  "Two friends taking a silly selfie",
  "A cat watering three small flowers",
  "A dog sleeping under a desk",
  "A person giving someone a warm scarf",
  "Two children jumping in one puddle",
  "A rabbit painting a tiny picture",
  "A superhero making breakfast",
  "A person waving from a train window",
  "Two friends sharing one pair of headphones",
  "A cat reaching for a falling leaf",
  "A child hugging a large teddy bear",
  "A couple watching stars from a rooftop",
  "A dog waiting beside a picnic basket",
  "A person planting a small tree",
  "Two birds building a nest together",
  "A baker presenting one perfect cupcake",
  "A child helping a snail cross a path",
  "Two friends playing a board game",
  "A cat sleeping on an open book",
  "A person carrying groceries in the rain",
  "A tiny ghost drinking hot chocolate",
  "A dog wearing a party hat",
  "A child mailing a heart-shaped letter",
  "Two people high-fiving after finishing a puzzle",
  "A rabbit holding a lantern at night",
  "A person teaching a robot to dance",
  "A cat and dog sharing a sunny windowsill",
  "A child making a snow angel",
] as const;

export function pickSuggestions(
  random: () => number = Math.random,
): readonly [string, string, string] {
  const shuffled = [...SCENE_SUGGESTIONS];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const value = random();
    const safeValue = Number.isFinite(value) ? Math.min(Math.max(value, 0), 0.999999) : 0;
    const swapIndex = Math.floor(safeValue * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return [shuffled[0], shuffled[1], shuffled[2]];
}
