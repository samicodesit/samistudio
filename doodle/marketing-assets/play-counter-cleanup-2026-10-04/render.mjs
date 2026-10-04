import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { renderIdeasScreenshot } from "./render-ideas.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const previous = JSON.parse(await fs.readFile(path.join(root, "manifest.json"), "utf8"));
const exportsDir = path.join(root, "exports");
await fs.mkdir(exportsDir, { recursive: true });
const region = { left: 115, top: 1710, width: 450, height: 90 };
const records = [];
const hash = bytes => createHash("sha256").update(bytes).digest("hex");

for (const [id, filename] of [["01", "01-idea-to-doodle.png"], ["04", "04-save-share.png"]]) {
  const original = await fs.readFile(path.join(root, `${id}-original.png`));
  const generated = await fs.readFile(path.join(root, `${id}-imagegen.png`));
  const source = await sharp(original).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const edited = await sharp(generated).resize(1080, 1920, { fit: "fill" }).extract(region).removeAlpha().raw().toBuffer();
  const panelColor = [...source.data.subarray((region.top * 1080 + region.left) * 3, (region.top * 1080 + region.left) * 3 + 3)];
  const means = [0, 0, 0];
  for (let i = 0; i < edited.length; i++) means[i % 3] += edited[i] / (region.width * region.height);
  const rgba = Buffer.alloc(region.width * region.height * 4);
  for (let y = 0; y < region.height; y++) for (let x = 0; x < region.width; x++) {
    const pixel = y * region.width + x;
    for (let c = 0; c < 3; c++) rgba[pixel * 4 + c] = Math.round(Math.max(0, Math.min(255, edited[pixel * 3 + c] + panelColor[c] - means[c])));
    rgba[pixel * 4 + 3] = Math.round(255 * Math.min(1, x / 12, y / 12, (region.width - 1 - x) / 12, (region.height - 1 - y) / 12));
  }
  const patch = await sharp(rgba, { raw: { width: region.width, height: region.height, channels: 4 } }).png().toBuffer();
  const output = await sharp(original).composite([{ input: patch, left: region.left, top: region.top }]).removeAlpha().png().toBuffer();
  const final = await sharp(output).raw().toBuffer();
  let changedInside = 0;
  let changedOutside = 0;
  let darkCounterPixels = 0;
  for (let y = 0; y < 1920; y++) for (let x = 0; x < 1080; x++) {
    const i = (y * 1080 + x) * 3;
    const changed = final[i] !== source.data[i] || final[i + 1] !== source.data[i + 1] || final[i + 2] !== source.data[i + 2];
    const inside = x >= region.left && x < region.left + region.width && y >= region.top && y < region.top + region.height;
    if (changed) { if (inside) changedInside++; else changedOutside++; }
    if (x >= 128 && x < 450 && y >= 1725 && y < 1780 && Math.min(...final.subarray(i, i + 3)) < 180) darkCounterPixels++;
  }
  if (changedOutside || darkCounterPixels) throw new Error(`Screenshot ${id}: counter removal or pixel preservation failed`);
  await fs.writeFile(path.join(exportsDir, filename), output);
  records.push({ slot: Number(id), file: `exports/${filename}`, source: `${id}-original.png`, sourceSha256: hash(original), imageGenEdit: `${id}-imagegen.png`, imageGenSha256: hash(generated), sha256: hash(output), region, changedInside, changedOutside, darkCounterPixels });
}

for (const [slot, source, filename] of [
  [2, path.join(root, "../play-detail-levels-2026-10-04/02-detail-levels.png"), "02-detail-levels.png"],
]) {
  const bytes = await fs.readFile(source);
  await fs.writeFile(path.join(exportsDir, filename), bytes);
  records.push({ slot, file: `exports/${filename}`, source: path.relative(root, source), sha256: hash(bytes), changedOutside: 0, unchanged: true });
}
records.push(await renderIdeasScreenshot());
records.sort((a, b) => a.slot - b.slot);
await fs.writeFile(path.join(root, "manifest.json"), JSON.stringify({
  status: "Current counter-free release candidates. Owner visual acceptance and publishing approval pending.",
  imageGenInstructions: previous.imageGenInstructions,
  dimensions: { width: 1080, height: 1920, alpha: false },
  method: "Built-in Image Gen removes counter text. Only the local blank-panel region is used, color-matched to the original panel and feathered at its edges. All other decoded pixels are verified identical. Originals are retained.",
  scope: "Marketing-only counter cleanup in screenshots 1 and 4. Screenshot 2 retained unchanged. Screenshot 3 simplified with larger original artwork and short labels. No app behavior or pricing changes.",
  review: "Inspect full-size and phone-size exports before publication. These are composed marketing assets, not new functional verification.",
  records,
}, null, 2) + "\n");
console.log(records.map(r => ({slot:r.slot, changedOutside:r.changedOutside, darkCounterPixels:r.darkCounterPixels, unchanged:r.unchanged})));
