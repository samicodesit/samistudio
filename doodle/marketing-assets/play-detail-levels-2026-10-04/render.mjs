import { chromium } from 'playwright';
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const dir = new URL('./', import.meta.url);
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
  const sources = await Promise.all(['simple', 'medium', 'detailed'].map(async level => {
    const path = new URL(`../../docs/qa/detail-levels/comparisons/2-1-${level}.png`, dir);
    return { level, path: `docs/qa/detail-levels/comparisons/2-1-${level}.png`, sha256: createHash('sha256').update(await readFile(path)).digest('hex') };
  }));
  const manifest = {
    status: 'Draft prepared. Owner permits slight paper-color drift and prefers the observed artwork. Whole-asset visual acceptance and publishing approval pending.',
    intendedSlot: 2,
    replaces: { path: 'marketing-assets/play-gallery-2026-10-02/exports/02-your-words.png', sha256: '07a36a0a43567383ce8d2083fcee7c686d5ae391326fde1d9725327cb076591a', source: 'Current submitted gallery manifest in main checkout, inspected 2026-10-04.' },
    output: '02-detail-levels.png',
    sha256: createHash('sha256').update(png).digest('hex'),
    dimensions: { width: 1080, height: 1920, alpha: false },
    scene: 'Two friends baking pancakes',
    provenance: 'Three saved genuine HIGH outputs. No additional generations, no recoloring, cropping, rotations or alterations to the source drawings. Upright square images scaled equally and staggered vertically with a 50 px corner overlap.',
    settings: { model: 'gpt-image-1-mini', quality: 'high', size: '1024x1024' },
    sources,
    qa,
    visualReview: 'Inspected at 1080x1920 and 390 px width on 2026-10-04. Drawings distinguishable, subjects visible, labels readable. Measurements confirm paper-color drift; the owner subsequently accepted slight drift and preferred the hatching and filled areas. See docs/qa/detail-levels/comparisons/paper-color-review.json. Whole-asset acceptance remains pending.',
    releaseGate: 'Publish alongside the shipped detail-level feature after owner approval. This is a composed feature illustration, not a Play-installed live capture. Preserve the artwork the owner likes.',
    guidance: { url: 'https://support.google.com/googleplay/android-developer/answer/9866151?hl=en', checked: '2026-10-04', applied: '1080x1920 opaque PNG; brief heading; no ranking, pricing or install claims; shows actual generated feature content.' },
    alt: 'The same cooking idea shown as Simple, Medium and Detailed Doodle drawings, arranged in a vertical stack.',
  };
  await writeFile(new URL('manifest.json', dir), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ output: manifest.output, sha256: manifest.sha256, qa }));
} finally { await browser.close(); }
