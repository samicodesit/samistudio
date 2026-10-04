import { chromium } from 'playwright';
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const base = process.argv[2];
if (!base?.startsWith('https://doodle-layout-review-') || !new URL(base).hostname.endsWith('.vercel.app')) throw Error('Expected isolated review deployment URL');
const dir = new URL('./', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', dir), 'utf8'));
const gallery = JSON.parse(await readFile(new URL('gallery-manifest.json', dir), 'utf8'));
const sources = JSON.parse(await readFile(new URL('coordinated-manifest.json', dir), 'utf8')).sources;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const checks = [];
for (const record of gallery.sources) {
  const response = await fetch(`${base}/release/${record.slot}.png`);
  if (response.status !== 200 || hash(Buffer.from(await response.arrayBuffer())) !== record.sha256) throw Error(`Remote export mismatch: ${record.slot}`);
}
for (const source of sources) if (hash(await readFile(new URL(`../../${source.originalPath}`, dir))) !== source.originalSha256) throw Error(`Original modified: ${source.id}`);
const info = await sharp(await readFile(new URL('02-detail-levels.png', dir))).metadata();
if (info.width !== 1080 || info.height !== 1920 || info.hasAlpha) throw Error('Incorrect store export dimensions or alpha');
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [320, 390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const response = await page.goto(`${base}/release.html`);
    await page.locator('img').evaluateAll(images => images.forEach(image => image.loading = 'eager'));
    await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
    const state = await page.evaluate(() => ({ allImagesDecoded: [...document.images].every(image => image.naturalWidth > 0), noHorizontalOverflow: document.documentElement.scrollWidth <= innerWidth, imageCount: document.images.length }));
    if (response.status() !== 200 || !state.allImagesDecoded || !state.noHorizontalOverflow) throw Error(`Browser check failed: ${width}`);
    if (width === 390) await page.screenshot({ path: fileURLToPath(new URL('preview-live-390.png', dir)), fullPage: true });
    checks.push({ width, anonymousHttp: response.status(), ...state });
    await page.close();
  }
} finally { await browser.close(); }
await writeFile(new URL('browser-preview.json', dir), JSON.stringify({ verifiedAt: new Date().toISOString(), url: `${base}/release.html`, imageUrl: `${base}/release/2.png`, outputSha256: manifest.sha256, allFourRemoteExportsMatch: true, originalSourcesUnchanged: true, checks, ownerMobileReview: 'Pending' }, null, 2) + '\n');
console.log(JSON.stringify({ url: `${base}/release.html`, allFourRemoteExportsMatch: true, checks }));
