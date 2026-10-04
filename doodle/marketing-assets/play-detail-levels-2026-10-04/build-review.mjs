import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, sep } from 'node:path';
import sharp from 'sharp';

const dir = new URL('./', import.meta.url);
const destination = new URL('../../.qa-phone-review/', dir);
if (!process.argv[2]) throw Error('Pass the current submitted gallery directory as the first argument');
const currentGallery = pathToFileURL(resolve(process.argv[2]) + sep);
const manifest = JSON.parse(await readFile(new URL('manifest.json', currentGallery), 'utf8'));
await mkdir(new URL('release/', destination), { recursive: true });
const sources = [];
for (let i = 0; i < 4; i++) {
  const record = manifest.records[i];
  const bytes = await readFile(i === 1 ? new URL('02-detail-levels.png', dir) : new URL(record.filename, currentGallery));
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (i !== 1 && hash !== record.sha256) throw Error(`Submitted screenshot ${i + 1} hash mismatch`);
  await writeFile(new URL(`release/${i + 1}.png`, destination), bytes);
  sources.push({ slot: i + 1, path: i === 1 ? '02-detail-levels.png' : record.filename, sha256: hash, status: i === 1 ? 'Revised draft. Owner acceptance pending.' : 'Unchanged submitted screenshot.' });
}
const composite = await Promise.all(sources.map(async (_, i) => ({ input: await sharp(await readFile(new URL(`release/${i + 1}.png`, destination))).resize(270, 480).toBuffer(), top: 16, left: 16 + i * 286 })));
await sharp({ create: { width: 1160, height: 512, channels: 3, background: '#F6F5F0' } }).composite(composite).png().toFile(fileURLToPath(new URL('gallery-review.png', dir)));
await copyFile(new URL('gallery-review.png', dir), new URL('release/gallery.png', destination));
await copyFile(new URL('coordinated-comparison.png', dir), new URL('release/comparison.png', destination));
await copyFile(new URL('02-detail-levels.png', dir), new URL('images/0.png', destination));
for (const subject of [1, 2]) for (const level of ['simple', 'medium', 'detailed']) await copyFile(new URL(`drawings/${subject}-1-${level}.png`, dir), new URL(`release/${subject}-${level}.png`, destination));
await writeFile(new URL('gallery-manifest.json', dir), JSON.stringify({ sources, referenceManifest: fileURLToPath(new URL('manifest.json', currentGallery)), verification: 'Slots 1, 3 and 4 match submitted byte hashes. Slot 2 keeps the same type scale, header offsets, fonts and brand text colors, on a lavender pastel backdrop.' }, null, 2) + '\n');
await writeFile(new URL('release.html', destination), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Doodle store review</title><style>*{box-sizing:border-box}body{margin:0;background:#F6F5F0;color:#22251F;font:16px/1.5 system-ui,sans-serif}main{max-width:900px;margin:auto;padding:16px}h1{font-size:25px;line-height:1.2;margin:0 0 8px}h2{font-size:20px;margin:32px 0 8px}p{margin:8px 0 16px}img{display:block;width:100%;height:auto}a{color:#195D48}.hero{max-width:540px;margin:auto}.gallery{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.gallery a{font-weight:600}.gallery img{margin-top:4px}.levels{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.levels span{display:block;font-size:14px;font-weight:600;margin-bottom:4px}section{margin:20px 0}.hint{font-size:14px;color:#526152}</style></head><body><main><h1>Revised screenshot 2</h1><p>Lavender backdrop, consistent yellow paper and the short-haired man in the Detailed drawing. Medium artwork remains unchanged.</p><p class="hint">Draft for owner review. The Detailed cooking image and Simple/Detailed cat images contain requested Image Gen edits. Original app evaluation outputs are preserved. Nothing is uploaded to Play Store.</p><a class="hero" href="release/2.png"><img src="release/2.png" width="1080" height="1920" alt="Updated screenshot 2 with three cooking drawings on lavender"></a><h2>Alongside the other three</h2><p class="hint">Screenshots 1, 3 and 4 are the unchanged submitted exports. Tap one to view it full size.</p><div class="gallery">${sources.map((_, i) => `<a href="release/${i + 1}.png">${i + 1}<img loading="lazy" src="release/${i + 1}.png" width="1080" height="1920" alt="Store screenshot ${i + 1}"></a>`).join('')}</div><h2>Coordinated drawing comparison</h2><p>Same cat, open eyes, flower on the right and tail on the left. Simple, Medium and Detailed from left to right.</p><a href="release/comparison.png"><img loading="lazy" src="release/comparison.png" width="1968" height="1316" alt="Three cat drawings above three cooking drawings"></a>${[1, 2].map(subject => `<section><h2>${subject === 1 ? 'Cat' : 'Cooking'}</h2><div class="levels">${['simple', 'medium', 'detailed'].map(level => `<a href="release/${subject}-${level}.png"><span>${level[0].toUpperCase() + level.slice(1)}</span><img loading="lazy" src="release/${subject}-${level}.png" width="1024" height="1024" alt="${level} ${subject === 1 ? 'cat' : 'cooking'} drawing"></a>`).join('')}</div></section>`).join('')}<p><a href="/">Selector UI previews</a> · <a href="/colors.html">Original paper-color trial</a></p></main></body></html>\n`);
console.log(JSON.stringify({ prepared: 'release.html', sources }));
