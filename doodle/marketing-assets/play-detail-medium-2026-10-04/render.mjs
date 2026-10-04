import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Reuse the reviewed caption, pastel background, shadows and equal-size layout.
// Replace only the illustration regions. Keep the owner's original Medium-detail
// example, whose HIGH rendering provenance is recorded separately from detail.
const dir = new URL('./', import.meta.url);
const root = new URL('../../', dir);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const previousPath = 'marketing-assets/play-detail-levels-2026-10-04/02-detail-levels.png';
const previous = await readFile(new URL(previousPath, root));
const previousManifest = JSON.parse(await readFile(new URL('marketing-assets/play-detail-levels-2026-10-04/manifest.json', root), 'utf8'));
if (sha256(previous) !== previousManifest.sha256) throw Error('Previous export does not match its manifest');
const generationPath = 'docs/qa/detail-render-matrix-2026-10-04/generation.json';
const generation = JSON.parse(await readFile(new URL(generationPath, root), 'utf8'));
const mask = Buffer.from('<svg width="540" height="540"><rect width="540" height="540" rx="3" fill="white"/></svg>');
// Directional contact shadow and a fine paper edge, never a colored mat.
const shadow = Buffer.from('<svg width="580" height="580"><defs><filter id="soft"><feGaussianBlur stdDeviation="6"/></filter></defs><path d="M24 30H559V550Q294 571 27 548Z" fill="#343027" opacity="0.24" filter="url(#soft)"/><path d="M27 551Q290 565 560 550" stroke="#343027" stroke-width="3" opacity="0.10" filter="url(#soft)"/></svg>');
const paperEdge = Buffer.from('<svg width="540" height="540"><path d="M1 539H539V1" fill="none" stroke="#9A8241" stroke-opacity="0.20" stroke-width="1"/></svg>');
const positions = [
  { level: 'simple', left: 100, top: 338 },
  { level: 'medium', left: 440, top: 828 },
  { level: 'detailed', left: 100, top: 1318 },
];
// Extra contact shadow is clipped to the sheet directly underneath.
// It darkens only the two overlap seams, never the drawings elsewhere.
function overlapContact(front, back) {
  const x = back.left - front.left + 20;
  const y = back.top - front.top + 20;
  return Buffer.from(`<svg width="580" height="580"><defs>
    <clipPath id="under"><rect x="${x}" y="${y}" width="540" height="540"/></clipPath>
    <linearGradient id="top" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#604B25" stop-opacity="0"/><stop offset="1" stop-color="#604B25" stop-opacity="0.32"/></linearGradient>
    <linearGradient id="left" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#604B25" stop-opacity="0"/><stop offset="1" stop-color="#604B25" stop-opacity="0.28"/></linearGradient>
    <linearGradient id="right" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#604B25" stop-opacity="0.28"/><stop offset="1" stop-color="#604B25" stop-opacity="0"/></linearGradient>
  </defs><g clip-path="url(#under)">
    <rect x="20" y="12" width="540" height="8" fill="url(#top)"/>
    <rect x="12" y="20" width="8" height="540" fill="url(#left)"/>
    <rect x="560" y="20" width="8" height="540" fill="url(#right)"/>
  </g></svg>`);
}
const layers = [];
const sources = [];
for (const [index, position] of positions.entries()) {
  const preferredMedium = position.level === 'medium';
  const path = preferredMedium
    ? 'marketing-assets/play-detail-levels-2026-10-04/drawings/2-1-medium.png'
    : `docs/qa/detail-render-matrix-2026-10-04/${position.level}-medium.png`;
  const bytes = await readFile(new URL(path, root));
  const record = generation.attempts.find(row => row.detailLevel === position.level && row.quality === 'medium');
  const preferredRecord = previousManifest.sources.find(row => row.level === 'medium');
  const expectedHash = preferredMedium ? preferredRecord.sha256 : record?.sha256;
  if (!record || record.status !== 'complete' || sha256(bytes) !== expectedHash || (preferredMedium && preferredRecord.edit !== null)) throw Error(`Source mismatch: ${path}`);
  const drawing = await sharp(bytes).resize(540, 540).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  const tile = await sharp(drawing).composite([{ input: paperEdge }]).png().toBuffer();
  layers.push({ input: shadow, left: position.left - 20, top: position.top - 20 });
  if (index > 0) layers.push({ input: overlapContact(position, positions[index - 1]), left: position.left - 20, top: position.top - 20 });
  layers.push({ input: tile, left: position.left, top: position.top });
  sources.push({ level: position.level, path, sha256: sha256(bytes), quality: preferredMedium ? 'high' : 'medium', scene: preferredMedium ? previousManifest.scene : generation.scene, promptVersion: record.promptVersion, ...(preferredMedium ? { originalPath: preferredRecord.originalPath, originalSha256: preferredRecord.originalSha256, ownerPreference: 'Owner explicitly requested this original Medium-detail illustration on October 4. The rendering-quality distinction was subsequently explained; the owner then requested clearer paper separation.' } : { promptSha256: record.promptSha256 }), paperCorrection: preferredMedium ? preferredRecord.correction : record.paperCorrection, drawingEdits: false });
}
await mkdir(dir, { recursive: true });
const output = await sharp(previous).composite(layers).removeAlpha().png().toBuffer();
await writeFile(new URL('02-detail-levels.png', dir), output);
await sharp(output).resize({ width: 390 }).png().toFile(fileURLToPath(new URL('phone-review.png', dir)));
const before = await sharp(previous).removeAlpha().raw().toBuffer();
const after = await sharp(output).removeAlpha().raw().toBuffer();
let changedOutside = 0;
for (let pixel = 0; pixel < 1080 * 1920; pixel += 1) {
  const x = pixel % 1080;
  const y = Math.floor(pixel / 1080);
  if (positions.some(p => x >= p.left - 20 && x < p.left + 560 && y >= p.top - 20 && y < p.top + 560)) continue;
  if ([0, 1, 2].some(channel => before[pixel * 3 + channel] !== after[pixel * 3 + channel])) changedOutside += 1;
}
if (changedOutside !== 0) throw Error('Caption or backdrop changed');
const baselineBytes = await readFile(new URL('before-overlap-treatment.png', dir));
if (sha256(baselineBytes) !== 'fe8452eb5e579103e13570856d8f87d2b552186681185bbe7ded3e2818683333') throw Error('Unexpected revision baseline');
const baseline = await sharp(baselineBytes).removeAlpha().raw().toBuffer();
const contactRegions = [
  { left: 432, top: 820, width: 208, height: 58 },
  { left: 440, top: 1310, width: 208, height: 58 },
];
let changedAtOverlap = 0;
let changedOutsideOverlap = 0;
for (let pixel = 0; pixel < 1080 * 1920; pixel++) {
  if (![0, 1, 2].some(c => baseline[pixel * 3 + c] !== after[pixel * 3 + c])) continue;
  const x = pixel % 1080, y = Math.floor(pixel / 1080);
  if (contactRegions.some(r => x >= r.left && x < r.left + r.width && y >= r.top && y < r.top + r.height)) changedAtOverlap++;
  else changedOutsideOverlap++;
}
if (changedOutsideOverlap !== 0 || changedAtOverlap === 0) throw Error('Overlap-only preservation failed');
const manifest = {
  status: 'Current screenshot revision. Added contact depth at the two overlap seams only, as requested by the owner. Visual QA pending.',
  intendedSlot: 2,
  output: '02-detail-levels.png',
  sha256: sha256(output),
  dimensions: { width: 1080, height: 1920, alpha: false },
  supersedes: { path: previousPath, sha256: sha256(previous), reason: 'Previous HIGH examples do not match the owner-selected MEDIUM production setting.' },
  scene: generation.scene,
  model: generation.model,
  productionQuality: 'medium',
  sources,
  method: 'Equal-size yellow-paper composition with directional contact shadows, a fine lower edge, plus narrow graduated contact shadows clipped to the underlying sheet at the two overlaps. No colored rims or corner shapes. Simple and Detailed use genuine MEDIUM-rendered outputs. The owner-selected original Medium-detail output was rendered at HIGH. All use the shared paper correction. Drawing interiors retained. Paper-edge overlays are marketing treatments only. Existing typography, backdrop and labels retained.',
  qa: { changedOutsideNoteAndShadowRectangles: changedOutside, baselineSha256: sha256(baselineBytes), contactRegions, changedAtOverlap, changedOutsideOverlap },
  noteTreatment: positions.map(({ level }) => ({ level, coloredRim: false, cornerTurnPixels: 0, directionalShadow: true })),
  visualReview: 'Pending full-size and 390px review of the strengthened overlap seams.',
  publishingAuthorization: 'Owner authorized deployment and publication of this release; this replacement addresses the independent reviewer store-representation finding.',
  limitation: 'Composed illustration of the detail feature, not a Play-installed screen capture or guarantee of identical characters across independent generations.',
  storeSuitability: 'The retained Medium-detail HIGH sample is visibly less complex than the newer MEDIUM-rendered Medium sample, and less detailed than the unedited MEDIUM-rendered Detailed sample. It preserves the level progression without showing a richer kitchen or more intricate drawing than the shipped pipeline. Rendering quality alone does not determine drawing complexity. Root accepts this specific genuine example, not arbitrary HIGH examples or generative retouching.',
};
await writeFile(new URL('manifest.json', dir), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ sha256: manifest.sha256, changedOutside, sources: sources.map(row => ({ level: row.level, quality: row.quality })) }));
