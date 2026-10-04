import { chromium } from 'playwright';
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { correctPaperColor } from '../../src/lib/generation/paper-color.ts';

const dir = new URL('./', import.meta.url);
const edits = JSON.parse(await readFile(new URL('edits/manifest.json', dir), 'utf8'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
await mkdir(new URL('drawings/', dir), { recursive: true });
const allSources = await Promise.all([1, 2].flatMap(scene => ['simple', 'medium', 'detailed'].map(async level => {
  const id = `${scene}-1-${level}`;
  const originalPath = `docs/qa/detail-levels/comparisons/${id}.png`;
  const original = await readFile(new URL(`../../${originalPath}`, dir));
  const edit = edits.records.find(record => record.id === id);
  const input = edit ? await readFile(new URL(edit.path, dir)) : original;
  const info = await sharp(input).metadata();
  if (info.width !== info.height) throw Error(`Expected square illustration for ${id}`);
  if (edit && sha256(input) !== edit.sha256) throw Error(`Edit hash mismatch for ${id}`);
  // Square resize and metadata normalization only. The shared helper handles paper color.
  const normalized = edit ? await sharp(input).resize(1024, 1024).toColourspace('srgb').removeAlpha().png().toBuffer() : input;
  const corrected = await correctPaperColor(normalized);
  if (!['corrected', 'unchanged'].includes(corrected.metadata.status)) throw Error(`Review source ${id}: ${corrected.metadata.status}`);
  const output = `drawings/${id}.png`;
  await writeFile(new URL(output, dir), corrected.bytes);
  return { id, scene, level, originalPath, originalSha256: sha256(original), edit: edit ?? null, path: output, sha256: sha256(corrected.bytes), correction: corrected.metadata };
})));
const sources = allSources.filter(source => source.scene === 2);
const tiles = await Promise.all(allSources.map(async (source, i) => ({ input: await sharp(await readFile(new URL(source.path, dir))).resize(640, 640).toBuffer(), left: 12 + (i % 3) * 652, top: 12 + Math.floor(i / 3) * 652 })));
await sharp({ create: { width: 1968, height: 1316, channels: 3, background: '#EEE7F2' } }).composite(tiles).png().toFile(fileURLToPath(new URL('coordinated-comparison.png', dir)));
await writeFile(new URL('coordinated-manifest.json', dir), JSON.stringify({ status: 'Coordinated marketing examples. Owner visual acceptance pending.', originalEvaluation: 'The original six production-model outputs remain unmodified under docs/qa/detail-levels/comparisons. Edited artwork is not evidence of production identity consistency.', order: ['Simple', 'Medium', 'Detailed'], rows: ['Cat holding a flower', 'Friends baking pancakes'], sources: allSources }, null, 2) + '\n');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto(new URL('02-detail-levels.html', dir).href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth === 1024));
  const qa = await page.evaluate(() => ({
    fonts: [...document.fonts].map(font => ({ family: font.family, weight: font.weight, status: font.status })),
    overflow: document.documentElement.scrollWidth > 1080 || document.documentElement.scrollHeight > 1920,
    labels: [...document.querySelectorAll('figcaption')].map(label => {
      const r = label.getBoundingClientRect();
      return { text: label.textContent, left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    }),
  }));
  if (qa.overflow || qa.fonts.some(font => font.status !== 'loaded') || qa.labels.some(label => label.left < 0 || label.right > 1080)) throw Error(JSON.stringify(qa));
  const capture = await page.screenshot();
  const png = await sharp(capture).removeAlpha().png().toBuffer();
  await writeFile(new URL('02-detail-levels.png', dir), png);
  await sharp(png).resize({ width: 390 }).png().toFile(fileURLToPath(new URL('phone-review.png', dir)));
  const manifest = {
    status: 'Updated draft with lavender backdrop and owner-requested Detailed character edit. Whole-asset visual acceptance and publishing approval pending.',
    intendedSlot: 2,
    replaces: { path: 'marketing-assets/play-gallery-2026-10-02/exports/02-your-words.png', sha256: '07a36a0a43567383ce8d2083fcee7c686d5ae391326fde1d9725327cb076591a', source: 'Current submitted gallery manifest in main checkout, inspected 2026-10-04.' },
    output: '02-detail-levels.png',
    sha256: sha256(png),
    dimensions: { width: 1080, height: 1920, alpha: false },
    scene: 'Two friends baking pancakes',
    provenance: 'Simple and Medium retain saved genuine HIGH artwork. Detailed has an owner-requested built-in Image Gen character edit. All three copies use the shared backend paper-color correction, paper-v1. Original evaluation outputs remain intact. Upright square images scaled equally and staggered vertically with a 50 px corner overlap.',
    originalGenerationSettings: { model: 'gpt-image-1-mini', quality: 'high', size: '1024x1024' },
    marketingEdits: 'edits/manifest.json',
    brand: { background: '#EEE7F2', paper: '#FFEB8A', heading: 'Bricolage Grotesque 700', body: 'IBM Plex Sans', color: '#22251F', headingSize: 96, subtitleSize: 36, headerOffset: { top: 42, left: 66 }, matches: 'Existing screenshot 1, 3 and 4 font files, type scale, header offsets, charcoal text, moss accents and restrained pastel treatment.' },
    sources,
    qa,
    visualReview: 'Revised lavender export, coordinated comparison and phone preview require visual inspection after rendering. Owner acceptance remains pending.',
    releaseGate: 'Publish alongside the shipped detail-level feature after owner approval. This is a composed feature illustration, not a Play-installed live capture. Preserve the artwork the owner likes.',
    guidance: { url: 'https://support.google.com/googleplay/android-developer/answer/9866151?hl=en', checked: '2026-10-04', applied: '1080x1920 opaque PNG; brief heading; no ranking, pricing or install claims; drawing examples include owner-requested marketing edits.' },
    alt: 'The same cooking idea shown as Simple, Medium and Detailed Doodle drawings, arranged in a vertical stack.',
  };
  await writeFile(new URL('manifest.json', dir), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ output: manifest.output, sha256: manifest.sha256, qa }));
} finally { await browser.close(); }
