import { mkdir, copyFile, writeFile } from 'node:fs/promises';

const root = new URL('../../../', import.meta.url);
const destination = new URL('.qa-phone-review/', root);
await mkdir(new URL('images/', destination), { recursive: true });
const items = [
  ['marketing-assets/play-detail-levels-2026-10-04/02-detail-levels.png', 'Draft Play Store screenshot 2'],
  ['docs/qa/detail-levels/web/app-en-320-2.png', '320 px, selector open'],
  ['docs/qa/detail-levels/web/app-en-320-collapsed.png', '320 px, selector hidden'],
  ['docs/qa/detail-levels/web/app-en-390-2.png', '390 px, selector open'],
  ['docs/qa/detail-levels/web/app-en-390-collapsed.png', '390 px, selector hidden'],
  ['docs/qa/detail-levels/web/app-ar-320-2.png', 'Arabic, 320 px, selector open'],
  ['docs/qa/detail-levels/web/app-ar-320-collapsed.png', 'Arabic, 320 px, selector hidden'],
  ['docs/qa/detail-levels/native/android-en-200-percent.png', 'Android, 200% text'],
  ['docs/qa/detail-levels/native/android-ar-200-percent.png', 'Android Arabic, 200% text'],
];
for (const [index, [path]] of items.entries()) await copyFile(new URL(path, root), new URL(`images/${index}.png`, destination));
const figures = items.map(([, label], index) => `<figure><figcaption>${label}</figcaption><a href="images/${index}.png"><img src="images/${index}.png" alt="${label}" loading="${index ? 'lazy' : 'eager'}"></a></figure>`).join('\n');
await writeFile(new URL('index.html', destination), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Doodle phone review</title>
<style>body{margin:0;background:#EDF1E8;color:#22251F;font:16px/1.5 system-ui,sans-serif}main{max-width:600px;margin:auto;padding:20px}h1{font-size:24px;margin:0 0 8px}p{margin:0 0 24px}figure{margin:0 0 32px}figcaption{font-weight:600;margin-bottom:8px}img{display:block;max-width:100%;height:auto;margin:auto}a{display:block}</style></head>
<body><main><h1>Doodle phone review</h1><p>Draft store asset and actual rendered UI captures. Account and generation responses in the UI captures are simulated. Native Android at 320 dp remains unchecked. Tap any image to open the original.</p>
${figures}
</main></body></html>\n`);
await writeFile(new URL('vercel.json', destination), JSON.stringify({ version: 2, framework: null, buildCommand: null, outputDirectory: '.', headers: [{ source: '/(.*)', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }] }, null, 2) + '\n');
console.log('Prepared static review: 9 unchanged PNGs. No app code, credentials or backend endpoints.');
