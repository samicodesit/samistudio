import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import OpenAI from "openai";
import { buildDoodlePrompt } from "../src/lib/generation/prompt";
import { generationProfile, type ImageQuality } from "../src/lib/generation/profile";
import { DETAIL_LEVELS, PROMPT_VERSIONS, type DetailLevel } from "../src/lib/generation/detail-level";
import { correctPaperColor } from "../src/lib/generation/paper-color";
import type { PaperCorrectionMetadata } from "../src/lib/generation/paper-color-metadata";

// A bounded owner-approved experiment. No app route, credits or production changes.
const directory = "docs/qa/detail-render-matrix-2026-10-04";
const scene = "Two friends making pancakes together in a cozy kitchen";
const budgetUsd = 0.18;
const outputEstimates = { low: 0.005, medium: 0.011, high: 0.036 };
type Attempt = {
  detailLevel: DetailLevel;
  quality: ImageQuality;
  promptVersion: string;
  promptSha256: string;
  status: "attempted" | "complete" | "failed";
  startedAt: string;
  generationMs?: number;
  usage?: { input_tokens: number; output_tokens: number };
  tokenRateEstimateUsd?: number;
  publishedRateEstimateUsd?: number;
  runningEstimateUsd?: number;
  paperCorrection?: PaperCorrectionMetadata;
  sha256?: string;
  originalSha256?: string;
};

if (!process.argv.includes("--approved-spend-0.18")) throw new Error("Requires owner approval for nine requests, at most $0.18");
if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.startsWith("test")) throw new Error("Real provider credentials unavailable");
if (generationProfile().model !== "gpt-image-1-mini") throw new Error("Unexpected model");
await mkdir(directory, { recursive: true });
const file = `${directory}/generation.json`;
try {
  await readFile(file);
  throw new Error("This batch has already been attempted. No duplicate requests or retries authorized");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
const attempts: Attempt[] = [];
const manifest = {
  approval: "Owner approved up to $0.18 total for nine requests, with no automatic retries.",
  scene, model: generationProfile().model, size: "1024x1024", imageCountPerRequest: 1,
  budgetUsd,
  pricing: { outputEstimatesUsd: outputEstimates, textInputUsdPerMillion: 2, imageOutputUsdPerMillion: 8 },
  costBasis: "Published per-image output estimates plus reported prompt tokens. Token-rate estimate retained separately. Not a reconciled invoice.",
  limitation: "One independent sample per detail and quality combination. Composition varies naturally. Not live-route or Play-installed end-to-end verification.",
  productionChanged: false,
  attempts,
};
const save = () => writeFile(file, JSON.stringify(manifest, null, 2) + "\n");
const sha = (input: string | Uint8Array) => createHash("sha256").update(input).digest("hex");
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 150_000, maxRetries: 0 });
await save();
let spentEstimateUsd = 0;
for (const detailLevel of DETAIL_LEVELS) {
  const profile = generationProfile(detailLevel);
  const prompt = buildDoodlePrompt(scene, profile);
  for (const quality of ["low", "medium", "high"] as const) {
    const previousUsage = attempts.find(row => row.detailLevel === detailLevel && row.usage)?.usage;
    const inputReserve = previousUsage?.input_tokens ?? Buffer.byteLength(prompt);
    if (spentEstimateUsd + outputEstimates[quality] + inputReserve * 2 / 1_000_000 > budgetUsd) {
      throw new Error("Approved remaining budget cannot cover this request");
    }
    const attempt: Attempt = { detailLevel, quality, promptVersion: PROMPT_VERSIONS[detailLevel],
      promptSha256: sha(prompt), status: "attempted", startedAt: new Date().toISOString() };
    attempts.push(attempt);
    await save();
    const started = Date.now();
    try {
      const response = await client.images.generate({ model: profile.model, prompt, n: 1, size: profile.size, quality });
      attempt.generationMs = Date.now() - started;
      if (!response.usage) throw new Error("Missing provider usage; stop rather than guess remaining budget");
      attempt.usage = response.usage;
      attempt.tokenRateEstimateUsd = (response.usage.input_tokens * 2 + response.usage.output_tokens * 8) / 1_000_000;
      attempt.publishedRateEstimateUsd = outputEstimates[quality] + response.usage.input_tokens * 2 / 1_000_000;
      spentEstimateUsd += attempt.publishedRateEstimateUsd;
      attempt.runningEstimateUsd = spentEstimateUsd;
      const encoded = response.data?.[0]?.b64_json;
      if (!encoded) throw new Error("Provider did not return PNG data");
      const bytes = Buffer.from(encoded, "base64");
      const filename = `${directory}/${detailLevel}-${quality}`;
      await writeFile(`${filename}-original.png`, bytes);
      const corrected = await correctPaperColor(bytes);
      await writeFile(`${filename}.png`, corrected.bytes);
      Object.assign(attempt, { status: "complete", paperCorrection: corrected.metadata,
        sha256: sha(corrected.bytes), originalSha256: sha(bytes) });
      await save();
      console.log(`${detailLevel}/${quality}: ${attempt.generationMs} ms, estimated $${attempt.publishedRateEstimateUsd.toFixed(6)}, batch estimate $${spentEstimateUsd.toFixed(6)}`);
    } catch {
      attempt.status = "failed";
      await save();
      throw new Error(`${detailLevel}/${quality} failed. No retry or further provider requests made`);
    }
  }
}
