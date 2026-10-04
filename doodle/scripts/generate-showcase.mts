import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { generateDoodle } from "../src/lib/generation/generate-doodle";
import { generationProfile } from "../src/lib/generation/profile";
import { PROMPT_VERSIONS, type DetailLevel } from "../src/lib/generation/detail-level";

if (!process.argv.includes("--approved-spend")) throw new Error("Requires owner approval for two HIGH generations, budget $0.10.");
const settings = generationProfile();
if (settings.model !== "gpt-image-1-mini" || settings.quality !== "high") throw new Error("Expected the approved production model and HIGH quality.");
const directory = "docs/design/showcase-2026-10-04";
await mkdir(directory, { recursive: true });
const manifestFile = `${directory}/generation.json`;
type Attempt = { id: string; scene: string; level: DetailLevel; promptVersion: string; status: string; durationMs?: number; sha256?: string; paperCorrection?: unknown };
let attempts: Attempt[] = [];
try { attempts = JSON.parse(await readFile(manifestFile, "utf8")).attempts; } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
const save = () => writeFile(manifestFile, JSON.stringify({ date: "2026-10-04", approval: "Owner approved at most two requests, $0.10 total. No retries.", settings, estimatedImageOutputCostUsd: 0.072, attempts }, null, 2) + "\n");
const inputs: { id: string; scene: string; level: DetailLevel }[] = [
  { id: "birthday-dog", scene: "A cheerful dog holding one birthday balloon", level: "simple" },
  { id: "bookshop", scene: "A cozy bookshop with bookshelves visible through its window, potted plants by the doorway, and a bicycle parked outside", level: "detailed" },
];
for (const input of inputs) {
  const previous = attempts.find(attempt => attempt.id === input.id);
  if (previous?.status === "complete") continue;
  if (previous) throw new Error("A previous request was attempted. No automatic retry is authorized.");
  const attempt: Attempt = { ...input, promptVersion: PROMPT_VERSIONS[input.level], status: "attempted" };
  attempts.push(attempt);
  await save();
  console.log(`Generating ${input.id}, ${input.level}, HIGH`);
  const started = Date.now();
  const result = await generateDoodle(input.scene, undefined, input.level);
  await writeFile(`${directory}/${input.id}.png`, result.bytes);
  Object.assign(attempt, { status: "complete", durationMs: Date.now() - started, sha256: createHash("sha256").update(result.bytes).digest("hex"), paperCorrection: result.paperCorrection });
  await save();
  console.log(`Saved ${input.id}`);
}
