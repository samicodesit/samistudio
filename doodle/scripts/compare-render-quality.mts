import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import OpenAI from "openai";
import { buildDoodlePrompt } from "../src/lib/generation/prompt";
import { generationProfile, type ImageQuality } from "../src/lib/generation/profile";
import { correctPaperColor } from "../src/lib/generation/paper-color";

// One owner-approved comparison, not an app route or automatic evaluation loop.
const directory = "docs/qa/render-quality-2026-10-04";
const scene = "A cozy bookshop with bookshelves visible through its window, potted plants by the doorway, and a bicycle parked outside";
const profile = generationProfile("detailed");
const prompt = buildDoodlePrompt(scene, profile);
if (profile.model !== "gpt-image-1-mini") throw new Error("Unexpected model");
if (!process.argv.includes("--approved-spend-0.06")) throw new Error("Requires the separate $0.06 owner approval");
if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.startsWith("test")) throw new Error("Real provider credentials unavailable");
await mkdir(directory, { recursive: true });
const file = `${directory}/generation.json`;
try {
  await readFile(file);
  throw new Error("Comparison has already been attempted. No retries authorized");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 150_000, maxRetries: 0 });
const attempts: Record<string, unknown>[] = [];
const manifest = {
  approval: "Owner approved up to $0.06 total for three requests. No retries.",
  model: profile.model, size: profile.size, scene, detailLevel: "detailed",
  promptVersion: "detailed-v1", promptSha256: createHash("sha256").update(prompt).digest("hex"),
  promptCharacters: prompt.length,
  pricing: { textInputUsdPerMillion: 2, imageOutputUsdPerMillion: 8, budgetUsd: 0.06 },
  costBasis: "Published per-image output estimates plus reported prompt tokens. Token-rate estimate also retained. No billing-invoice reconciliation.",
  limitation: "One independent sample per setting. Composition can vary naturally. Not a production end-to-end check.",
  attempts,
};
const save = () => writeFile(file, JSON.stringify(manifest, null, 2) + "\n");
await save();
let spentUsd = 0;
for (const quality of ["low", "medium", "high"] as ImageQuality[]) {
  // The identical prompt's input count is known after the first response.
  const previousUsage = attempts.find(row => row.usage)?.usage as { input_tokens: number } | undefined;
  const inputReserve = previousUsage?.input_tokens ?? Buffer.byteLength(prompt);
  const outputEstimate = { low: 0.005, medium: 0.011, high: 0.036 }[quality];
  const reserveUsd = outputEstimate + inputReserve * 2 / 1_000_000;
  if (spentUsd + reserveUsd > 0.06) throw new Error("Remaining approved budget cannot cover this request");
  const attempt: Record<string, unknown> = { quality, status: "attempted", startedAt: new Date().toISOString() };
  attempts.push(attempt);
  await save();
  const started = Date.now();
  try {
    const response = await client.images.generate({ model: profile.model, prompt, n: 1, size: profile.size, quality });
    const generationMs = Date.now() - started;
    const usage = response.usage;
    if (!usage) throw new Error("Provider usage missing; stop rather than guess remaining budget");
    const tokenRateEstimateUsd = (usage.input_tokens * 2 + usage.output_tokens * 8) / 1_000_000;
    const publishedRateEstimateUsd = outputEstimate + usage.input_tokens * 2 / 1_000_000;
    spentUsd += publishedRateEstimateUsd;
    attempt.usage = usage;
    attempt.tokenRateEstimateUsd = tokenRateEstimateUsd;
    attempt.publishedRateEstimateUsd = publishedRateEstimateUsd;
    attempt.runningEstimateUsd = spentUsd;
    const encoded = response.data?.[0]?.b64_json;
    if (!encoded) throw new Error("No PNG returned");
    const bytes = Buffer.from(encoded, "base64");
    await writeFile(`${directory}/${quality}-original.png`, bytes);
    const corrected = await correctPaperColor(bytes);
    await writeFile(`${directory}/${quality}.png`, corrected.bytes);
    Object.assign(attempt, { status: "complete", generationMs, paperCorrection: corrected.metadata,
      sha256: createHash("sha256").update(corrected.bytes).digest("hex"),
      originalSha256: createHash("sha256").update(bytes).digest("hex") });
    await save();
    console.log(`${quality}: ${generationMs} ms, estimated $${publishedRateEstimateUsd.toFixed(6)}, total estimated $${spentUsd.toFixed(6)}`);
  } catch {
    attempt.status = "failed";
    await save();
    throw new Error(`Request for ${quality} failed. No retry or additional request made.`);
  }
}
