import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { chromium } from 'playwright';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../../../..');
const preview = path.join(root, '.qa-phone-review');
const css = `@font-face{font-family:Bricolage;src:url(FONTS/BricolageGrotesque-Variable.ttf);font-weight:100 900}@font-face{font-family:Plex;src:url(FONTS/IBMPlexSans-Variable.ttf);font-weight:100 900}*{box-sizing:border-box}body{margin:0;background:#eef1ea;color:#20231f;font:16px/1.5 Plex,sans-serif}main{max-width:1220px;padding:24px 16px;margin:auto}h1,h2{font-family:Bricolage;line-height:1.2}h1{font-size:28px;margin:0 0 12px}h2{font-size:22px;margin:0 0 10px}p{max-width:640px;margin:0 0 16px}a{color:#195c47}nav{display:flex;gap:20px;margin-bottom:24px}.options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}section{scroll-margin-top:16px}img{display:block;width:100%;height:auto;border:1px solid #d7ddd5;border-radius:8px}.note{color:#657064;font-size:14px}@media(max-width:760px){main{max-width:422px}.options{grid-template-columns:1fr;gap:32px}}`;
function render(prefix, fonts, comparison) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Doodle hero art concepts</title><style>${css.replaceAll('FONTS', fonts)}</style></head><body><main><h1>A quiet touch of art</h1><p>Three Android hero concepts for choosing together.</p><p class="note">Image-generated visual concepts based on the current Android fixture. These are illustrations of the design, not implemented or interactive app screens. Minor rendering differences are possible.</p><nav aria-label="Concepts"><a href="#option-1">Option 1</a><a href="#option-2">Option 2</a><a href="#option-3">Option 3</a></nav><div class="options">${[1,2,3].map(n=>`<section id="option-${n}"><h2>Option ${n}</h2><a href="${prefix}option-${n}.png" aria-label="Open full-size option ${n}"><img src="${prefix}option-${n}.png" alt="Android hero art concept ${n}" loading="eager"></a></section>`).join('')}</div><p style="margin-top:28px"><a href="${comparison}">Review the current Android spacing</a></p></main></body></html>`;
}

await fs.mkdir(path.join(preview, 'hero-art'), { recursive: true });
const assets = [];
for (const n of [1,2,3]) {
  const file = `option-${n}.png`;
  const bytes = await fs.readFile(path.join(dir, file));
  const metadata = await sharp(bytes).metadata();
  assets.push({ option:n, file, sha256:createHash('sha256').update(bytes).digest('hex'), width:metadata.width, height:metadata.height, provenance:'Built-in ImageGen edit grounded in current native-en-390 capture and existing flower-cat artwork', reviewStatus:'Agent inspected at phone size. Owner choice pending. Illustrative concept only.' });
  await fs.copyFile(path.join(dir, file), path.join(preview, 'hero-art', file));
}
await fs.writeFile(path.join(dir, 'gallery.html'), render('', '../../../../mobile/assets', '../hero-spacing/gallery.html'));
await fs.writeFile(path.join(preview, 'hero-art.html'), render('hero-art/', 'implemented', 'spacing.html'));
const browser = await chromium.launch({headless:true});
const checks=[];
try {
  for (const width of [320,390,1440]) {
    const page=await browser.newPage({viewport:{width,height:900}});
    await page.goto('file://'+path.join(dir,'gallery.html'));
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForFunction(()=>[...document.images].every(img=>img.complete&&img.naturalWidth>0));
    const check=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,images:[...document.images].map(img=>({width:img.getBoundingClientRect().width,naturalWidth:img.naturalWidth})),fonts:[...document.fonts].map(f=>({family:f.family,status:f.status}))}));
    if(check.overflow||check.images.length!==3||check.fonts.some(f=>f.status!=='loaded'))throw Error(JSON.stringify(check));
    checks.push(check);
    if(width===390){for(const n of [1,2,3]){await page.locator(`#option-${n}`).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(dir,`review-${n}.png`)});}}
    await page.close();
  }
} finally {await browser.close();}
await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify({date:'2026-10-04',status:'Three independent concepts displayed in numerical order. Owner selection pending. No app implementation or release.',sourceScreenshot:'../hero-spacing/native-en-390.png',sourceArtwork:'../../../../public/landing/flower-cat.webp',sourceCommit:'61c24af',generator:'Built-in ImageGen',prompts:'prompts.json',assets,checks},null,2)+'\n');
console.log(JSON.stringify({assets,checks}));
