import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateDoodle } from "../src/lib/generation/generate-doodle";
import { DETAIL_LEVELS, PROMPT_VERSIONS, type DetailLevel } from "../src/lib/generation/detail-level";
import { generationProfile } from "../src/lib/generation/profile";
const twoRounds = process.argv.includes("--two-rounds");
const repeats = twoRounds ? 1 : 2;
const expectedImages = twoRounds ? 6 : 36;
if (!process.argv.includes("--approved-spend")) throw new Error("Requires separate owner approval for " + expectedImages + " paid generations. Pass --approved-spend only after approval.");
if (twoRounds && generationProfile().quality !== "high") throw new Error("The approved two-round comparison requires OPENAI_IMAGE_QUALITY=high.");
const scenes = twoRounds ? [
  "A cat holding a small flower",
  "Two friends baking pancakes",
] : [
  "A steaming mug beside a folded thank-you note with a tiny heart on it",
  "A cat and dog sharing a sunny windowsill",
  "Two friends baking pancakes",
  "A child running with a kite",
  "A sleepy astronaut resting on the moon",
  "قطة تحتمي بمظلة صغيرة من المطر",
];
const directory = path.join(process.cwd(), "tmp/detail-eval", new Date().toISOString().replace(/[:.]/g, "-"));
await mkdir(directory, { recursive: true });
const outputs: { sceneIndex: number; repeat: number; level: DetailLevel; promptVersion: string; filename: string; durationMs: number }[] = [];
const manifest = () => writeFile(path.join(directory, "manifest.json"), JSON.stringify({
  scenes, expectedImages, settings: generationProfile(), outputs,
  review: twoRounds ? "Pending human comparison of two sets. Check increasing complexity, subject fidelity, readability and style." : "Pending human comparison of 12 sets. Require clear increasing complexity in at least 10, with subject fidelity, readability and style.",
}, null, 2));
for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex++) {
  for (let repeat = 1; repeat <= repeats; repeat++) {
    for (const level of DETAIL_LEVELS) {
      const started = Date.now();
      const result = await generateDoodle(scenes[sceneIndex], undefined, level);
      const filename = `${sceneIndex + 1}-${repeat}-${level}.png`;
      await writeFile(path.join(directory, filename), result.bytes);
      outputs.push({ sceneIndex, repeat, level, promptVersion: PROMPT_VERSIONS[level], filename, durationMs: Date.now() - started });
      await manifest();
      console.log(`Saved ${outputs.length}/${expectedImages}: ${filename}`);
    }
  }
}
console.log(`Ready for visual comparison: ${directory}`);
