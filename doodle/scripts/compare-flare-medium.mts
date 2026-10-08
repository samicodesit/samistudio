import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import OpenAI from "openai";
import { buildDoodlePrompt } from "../src/lib/generation/prompt";
import { generationProfile } from "../src/lib/generation/profile";
import { PROMPT_VERSIONS } from "../src/lib/generation/detail-level";
import { correctPaperColor } from "../src/lib/generation/paper-color";

// Isolated comparison. Existing Mini results are reused; production stays unchanged.
const directory = "docs/qa/flare-medium-2026-10-04";
const previous = JSON.parse(await readFile("docs/qa/detail-render-matrix-2026-10-04/generation.json", "utf8"));
const model = "gpt-image-2.5-flare";
const quality = "medium";
const budgetUsd = 0.06;
const outputEstimateUsd = 0.01317;
const sha = (input: string | Uint8Array) => createHash("sha256").update(input).digest("hex");
const plans = (["simple", "detailed"] as const).map(detailLevel => {
  const profile = generationProfile(detailLevel);
  const prompt = buildDoodlePrompt(previous.scene, profile);
  const baseline = previous.attempts.find((row: { detailLevel: string; quality: string }) => row.detailLevel === detailLevel && row.quality === quality);
  if (!baseline || baseline.status !== "complete" || sha(prompt) !== baseline.promptSha256) throw new Error("Baseline prompt mismatch");
  return { detailLevel, prompt, promptSha256: sha(prompt), baseline };
});
const reserveFor = (prompt: string) => outputEstimateUsd + Buffer.byteLength(prompt) * 5 / 1_000_000;
if (plans.reduce((sum, plan) => sum + reserveFor(plan.prompt), 0) > budgetUsd) throw new Error("Conservative estimate exceeds proposed budget");
if (process.argv.includes("--dry-run")) {
  console.log(JSON.stringify({ model, quality, size: "1024x1024", requests: plans.length, budgetUsd,
    detailLevels: plans.map(p => p.detailLevel), promptsMatchBaselines: true,
    estimatedCostUsingBaselineInputTokens: plans.reduce((sum, p) => sum + outputEstimateUsd + p.baseline.usage.input_tokens * 5 / 1_000_000, 0),
    conservativeReserveUsd: plans.reduce((sum, p) => sum + reserveFor(p.prompt), 0), providerCalls: 0 }, null, 2));
  process.exit(0);
}
if (!process.argv.includes("--approved-spend-0.06")) throw new Error("Requires explicit owner approval for two requests up to $0.06");
if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.startsWith("test")) throw new Error("Real credentials unavailable");
await mkdir(directory, { recursive: true });
const file = `${directory}/generation.json`;
try { await readFile(file); throw new Error("Batch already attempted. Duplicate requests and retries are not authorized"); }
catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
const attempts: Record<string, unknown>[] = [];
const manifest = { approval: "Owner approved up to $0.06 for two Flare MEDIUM outputs, no automatic retries.",
  scene: previous.scene, model, quality, size: "1024x1024", imageCountPerRequest: 1, budgetUsd,
  pricing: { outputEstimateUsd, textInputUsdPerMillion: 5, imageOutputUsdPerMillion: 30 },
  pricingSource: "https://developers.openai.com/api/docs/guides/image-generation#cost-and-latency",
  estimateCheckedAt: "2026-10-04", productionChanged: false,
  baseline: "../detail-render-matrix-2026-10-04/generation.json", attempts };
const save = () => writeFile(file, JSON.stringify(manifest, null, 2) + "\n");
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: 150_000 });
let spentEstimateUsd = 0;
await save();
for (const plan of plans) {
  if (spentEstimateUsd + reserveFor(plan.prompt) > budgetUsd) throw new Error("Insufficient remaining approved budget");
  const attempt: Record<string, unknown> = { detailLevel: plan.detailLevel, promptVersion: PROMPT_VERSIONS[plan.detailLevel],
    promptSha256: plan.promptSha256, status: "attempted", startedAt: new Date().toISOString() };
  attempts.push(attempt);
  await save();
  const started = Date.now();
  try {
    const response = await client.images.generate({ model, prompt: plan.prompt, quality, size: "1024x1024", n: 1, output_format: "png" });
    attempt.generationMs = Date.now() - started;
    if (!response.usage) throw new Error("Usage missing; stop before further requests");
    attempt.usage = response.usage;
    const estimate = (response.usage.input_tokens * 5 + response.usage.output_tokens * 30) / 1_000_000;
    spentEstimateUsd += estimate;
    attempt.tokenRateEstimateUsd = estimate;
    attempt.runningEstimateUsd = spentEstimateUsd;
    const encoded = response.data?.[0]?.b64_json;
    if (!encoded) throw new Error("PNG missing");
    const bytes = Buffer.from(encoded, "base64");
    await writeFile(`${directory}/${plan.detailLevel}-original.png`, bytes);
    const corrected = await correctPaperColor(bytes);
    await writeFile(`${directory}/${plan.detailLevel}.png`, corrected.bytes);
    Object.assign(attempt, { status: "complete", paperCorrection: corrected.metadata,
      originalSha256: sha(bytes), sha256: sha(corrected.bytes) });
    await save();
    console.log(`${plan.detailLevel}: ${attempt.generationMs} ms, estimated $${estimate.toFixed(6)}, batch $${spentEstimateUsd.toFixed(6)}`);
  } catch (error) {
    attempt.status = "failed";
    if (error instanceof OpenAI.APIError) Object.assign(attempt, { httpStatus: error.status, providerCode: error.code, requestId: error.requestID });
    await save();
    throw new Error(`${plan.detailLevel} failed. No retry or further requests made`);
  }
}
