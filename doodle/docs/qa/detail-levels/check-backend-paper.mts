import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import sharp from "sharp";
import { correctPaperColor } from "../../../src/lib/generation/paper-color";

const comparisons = new URL("comparisons/", import.meta.url);
const names = ["1-1-simple", "1-1-medium", "1-1-detailed", "2-1-simple", "2-1-medium", "2-1-detailed"];
const rows = [];
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
for (const name of names) {
  const input = await readFile(new URL(`${name}.png`, comparisons));
  const accepted = await readFile(new URL(`paper-color-trial/${name}.png`, comparisons));
  const cpu = process.cpuUsage();
  const result = await correctPaperColor(input);
  const used = process.cpuUsage(cpu);
  assert.equal(result.metadata.status, "corrected");
  const actualPixels = await sharp(result.bytes).ensureAlpha().raw().toBuffer();
  const acceptedPixels = await sharp(accepted).ensureAlpha().raw().toBuffer();
  assert(actualPixels.equals(acceptedPixels));
  rows.push({ name, ...result.metadata, cpuMs: Math.round((used.user + used.system) / 1000), originalSha256: sha(input), correctedSha256: sha(result.bytes), matchesReviewedPixels: true });
}
const record = { verifiedAt: new Date().toISOString(), runtime: process.version, environment: "Local WSL, production helper on six saved HIGH provider PNGs. No provider calls or deployment.", meanDurationMs: Math.round(rows.reduce((sum, row) => sum + row.durationMs, 0) / rows.length), rows };
await writeFile(new URL("paper-color-trial/backend-verification.json", comparisons), JSON.stringify(record, null, 2) + "\n");
console.log(JSON.stringify(record, null, 2));
