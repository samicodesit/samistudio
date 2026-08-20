import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateDoodle } from "../src/lib/generation/generate-doodle";
import { SIMPLE_PROFILE } from "../src/lib/generation/profile";

const scenes = [
  "A cat in a raincoat sharing its umbrella with a tiny bird",
  "Two friends baking pancakes",
  "A grandparent teaching a child to fish",
  "Two cats recreating the upside-down Spider-Man kiss",
  "A sleepy astronaut resting on the moon",
  "A person warming both hands around a steaming mug",
  "A child running with a kite",
  "A dog offering a small flower to a cat",
] as const;

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputDirectory = path.join(process.cwd(), "tmp", "prompt-eval", timestamp);
await mkdir(outputDirectory, { recursive: true });

const manifest: Array<{ scene: string; model: string; quality: string; filename: string }> = [];

for (const [index, scene] of scenes.entries()) {
  process.stdout.write(`Generating ${index + 1}/${scenes.length}: ${scene}\n`);
  const result = await generateDoodle(scene);
  const filename = `${String(index + 1).padStart(2, "0")}.png`;
  await writeFile(path.join(outputDirectory, filename), result.bytes);
  manifest.push({
    scene,
    model: SIMPLE_PROFILE.model,
    quality: SIMPLE_PROFILE.quality,
    filename,
  });
}

await writeFile(
  path.join(outputDirectory, "manifest.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), outputs: manifest }, null, 2),
);
process.stdout.write(`Wrote ${manifest.length} images to ${outputDirectory}\n`);
