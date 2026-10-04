import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { chromium } from 'playwright';

const dir = 'docs/design/showcase-2026-10-04';
const inputs = [
  { id: 'birthday-dog', level: 'simple', path: `${dir}/birthday-dog.png`, mat: '#E3EABD', rotation: -4 },
  { id: 'cooking-friends', level: 'medium', path: 'marketing-assets/play-detail-levels-2026-10-04/drawings/2-1-medium.png', mat: '#F0E6D0', rotation: 1 },
  { id: 'bookshop', level: 'detailed', path: `${dir}/bookshop.png`, mat: '#E7E2F0', rotation: 3 },
];
const records = [];
const images = [];
for (const input of inputs) {
  const bytes = await fs.readFile(input.path);
  records.push({ ...input, sha256: createHash('sha256').update(bytes).digest('hex'), provenance: input.id === 'cooking-friends' ? 'Unedited genuine HIGH evaluation output, with shared paper-v1 correction' : 'Genuine production generator output, HIGH quality and shared paper-v1 correction' });
  images.push(`<div class="note" style="background:${input.mat};transform:rotate(${input.rotation}deg)"><img src="data:image/png;base64,${bytes.toString('base64')}" alt=""></div>`);
  const exported = await sharp(bytes).webp({ quality: 90 }).toBuffer();
  const webId = input.id === 'birthday-dog' ? 'birthday-balloon-dog' : input.id;
  await fs.writeFile(`public/ideas/${webId}.webp`, exported);
  await fs.writeFile(`mobile/assets/${input.id}.webp`, exported);
}
const html = `<!doctype html><html><head><style>*{box-sizing:border-box}html,body{margin:0;width:1400px;height:527px;background:transparent}.row{height:100%;display:flex;align-items:center;justify-content:space-between;padding:30px 40px;gap:42px}.note{width:400px;flex:none;padding:14px 14px 26px;border-radius:2px;box-shadow:0 5px 9px #20231f16}.note img{display:block;width:372px;height:372px;object-fit:contain}</style></head><body><div class="row">${images.join('')}</div></body></html>`;
const browser = await chromium.launch();
let screenshot;
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 527 } });
  await page.setContent(html);
  await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
  screenshot = await page.screenshot({ omitBackground: true });
} finally { await browser.close(); }
await fs.writeFile(`${dir}/triptych.png`, screenshot);
const webp = await sharp(screenshot).webp({ quality: 92 }).toBuffer();
await fs.writeFile('public/landing/detail-examples.webp', webp);
await fs.writeFile('mobile/assets/pastel-examples.webp', webp);
await fs.writeFile(`${dir}/manifest.json`, JSON.stringify({ date: '2026-10-04', status: 'Owner approved subjects and range. Rendered visual acceptance pending.', sources: records, composition: 'Full uncropped app outputs on restrained pastel backing cards. Artwork color and drawing retained; no ImageGen edits. Decorative rotations only, no text in export.', output: 'public/landing/detail-examples.webp', nativeOutput: 'mobile/assets/pastel-examples.webp', dimensions: [1400, 527], bytes: webp.length, sha256: createHash('sha256').update(webp).digest('hex') }, null, 2) + '\n');
console.log('Exported shared showcase', webp.length, 'bytes');
