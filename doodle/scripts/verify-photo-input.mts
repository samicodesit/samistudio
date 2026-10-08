// Explicitly invoked paid integration verification. Never included in test suites.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import OpenAI from "openai";
import { normalizePhoto } from "../src/lib/generation/photo";
import { generatePhotoDoodle } from "../src/lib/generation/generate-photo-doodle";
import { generationProfile } from "../src/lib/generation/profile";

const [inputPath, outputPath, approvedCap] = process.argv.slice(2);
const cap = Number(approvedCap);
if (!inputPath || !outputPath || !Number.isFinite(cap) || cap <= 0 || cap > 0.3) throw new Error("Usage: verify-photo-input.mts INPUT OUTPUT APPROVED_CAP_USD (maximum 0.30)");
if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required");
if (generationProfile().model !== "gpt-image-2.5-flare") throw new Error("Production Flare is required; refusing to spend on another model");
const photo = await normalizePhoto((await readFile(inputPath)).toString("base64"));
await mkdir(outputPath, { recursive: true });
const client = new OpenAI({ timeout: 150_000, maxRetries: 0 });
const results: object[] = [];
let spent = 0;
for (const detail of ["simple", "medium", "detailed"] as const) {
  // Each request reserves a conservative $0.10 of the approved run cap.
  if (spent + 0.1 > cap + 0.000001) throw new Error("Insufficient remaining approved budget");
  let provider: { requestId?: string | null; usage?: OpenAI.Images.ImagesResponse.Usage; httpMs?: number } = {};
  const started = performance.now();
  const result = await generatePhotoDoodle(photo, detail, { edit: async input => {
    const httpStarted = performance.now();
    const response = await client.images.edit(input);
    provider = { requestId: response._request_id, usage: response.usage, httpMs: Math.round(performance.now() - httpStarted) };
    return response;
  } });
  const usage = provider.usage;
  if (!usage) throw new Error("Missing provider usage; stop for budget review");
  const details = usage.input_tokens_details;
  const estimatedUsd = ((details?.text_tokens ?? 0) * 5 + (details?.image_tokens ?? 0) * 8 + usage.output_tokens * 30) / 1_000_000;
  spent += estimatedUsd;
  const file = resolve(outputPath, `${detail}.png`);
  await writeFile(file, result.bytes);
  results.push({ detail, model: "gpt-image-2.5-flare", quality: "medium", size: "1024x1024", ...provider, elapsedMs: Math.round(performance.now() - started), estimatedUsd, outputSha256: createHash("sha256").update(result.bytes).digest("hex"), file, paperCorrection: result.paperCorrection });
  await writeFile(resolve(outputPath, "live-generation.json"), JSON.stringify({ date: new Date().toISOString(), approvedRunCapUsd: cap, priorExperimentEstimatedUsd: 1.089289, invalidConfigurationRunBudgetChargeUsd: 0.113483, estimatedRunUsd: spent, estimatedCumulativeBudgetChargeUsd: 1.089289 + 0.113483 + spent, inputSha256: createHash("sha256").update(photo).digest("hex"), results }, null, 2));
  console.log(JSON.stringify({ detail, httpMs: provider.httpMs, estimatedUsd }));
}
