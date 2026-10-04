import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {chromium} from 'playwright';
const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'../../../..');
const preview=path.join(root,'.qa-phone-review');
const output=path.join(dir,'before-after');
await fs.mkdir(output,{recursive:true});
const items=[
 ['desktop','Desktop web','web/web-en-1280-1.png','hero/web-en-desktop.png',900,'Before: 1280 px. After: 1440 px. First screen shown.'],
 ['phone','Mobile web, 390 px','web/web-en-390-0.png','hero/web-en-390.png',844,'Matching width. First screen shown.'],
 ['small','Small phone web, 320 px','web/web-en-320-2.png','hero/web-en-320.png',844,'Matching width. First screen shown.'],
 ['installed','Installed web, 390 px','web/app-en-390-2.png','hero/app-en-390.png',null,'Matching width.'],
 ['arabic','Arabic installed web, 320 px','web/app-ar-320-2.png','hero/app-ar-320.png',null,'Matching width. Drawer mirrors to the left.'],
 ['android','Android, normal text','native/android-en-simple.png','hero/native-en-320.png',null,'Before: about 411 dp. After: 320 dp. Different emulator widths.'],
 ['hidden','Android, drawer hidden','native/android-en-collapsed.png','hero/native-en-320-collapsed.png',null,'Before: about 411 dp. After: 320 dp. Different emulator widths.'],
 ['large','Android, 200% text','native/android-en-200-percent.png','hero/native-en-320-large.png',null,'Before: about 411 dp. After: 320 dp. Different emulator widths.'],
 ['rtl-large','Arabic Android, 200% text','native/android-ar-200-percent.png','hero/native-ar-320-large.png',null,'Before: about 411 dp. After: 320 dp. Different emulator widths.'],
 ['store','Store screenshot 3','../../../marketing-assets/play-counter-cleanup-2026-10-04/03-original.png','../../../marketing-assets/play-counter-cleanup-2026-10-04/exports/03-find-an-idea.png',null,'Marketing composition only. Both exports are 1080 x 1920.']
];
const qaRoot=path.join(root,'docs/qa/detail-levels');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const records=[];
for(const [id,title,before,after,cropHeight,note] of items){
  const sides=[];
  for(const [side,source] of [['before',before],['after',after]]){
    const sourcePath=path.resolve(qaRoot,source);
    const bytes=await fs.readFile(sourcePath);
    const meta=await sharp(bytes).metadata();
    const crop=side==='before'&&cropHeight&&meta.height>cropHeight?{left:0,top:0,width:meta.width,height:cropHeight}:null;
    const result=crop?await sharp(bytes).extract(crop).png().toBuffer():bytes;
    const file=`${id}-${side}.png`;
    await fs.writeFile(path.join(output,file),result);
    const dimensions=await sharp(result).metadata();
    sides.push({side,file,source:path.relative(root,sourcePath).split(path.sep).join('/'),sourceSha256:hash(bytes),sha256:hash(result),width:dimensions.width,height:dimensions.height,crop,reviewStatus:side==='before'?'Historical capture, allowed for before comparison only. Superseded, not a current UI or marketing candidate.':'Current reviewed candidate. Owner acceptance pending.'});
  }
  records.push({id,title,note,sides});
}
const style=`@font-face{font-family:Bricolage;src:url('../implemented/BricolageGrotesque-Variable.ttf') format('truetype');font-weight:100 900}@font-face{font-family:Plex;src:url('../implemented/IBMPlexSans-Variable.ttf') format('truetype');font-weight:100 900}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#eef1ea;color:#20231f;font:16px/1.5 Plex,sans-serif}main{max-width:1100px;margin:auto;padding:24px 16px}h1{font:600 30px/1.15 Bricolage;margin:0 0 12px}h2{font:600 23px/1.2 Bricolage;margin:0 0 8px}p{margin:0 0 16px;max-width:720px}a{color:#1a614d}nav{display:flex;flex-wrap:wrap;gap:8px 16px;margin:24px 0 32px}nav a{font-size:14px}section{margin:0 0 44px;scroll-margin-top:20px}.note{font-size:13px;color:#657064;margin-bottom:14px}.pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;align-items:start}figure{margin:0;min-width:0}figcaption{font-weight:600;margin-bottom:8px}img{display:block;width:100%;height:auto;border-radius:8px;border:1px solid #d7ddd5}.status{font-size:14px;color:#657064}@media(min-width:800px){.pair:not(.desktop){max-width:804px;margin:0 auto}.pair{gap:24px}}`;
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Doodle UI, before and after</title><style>${style}</style></head><body><main><h1>Doodle, before and after</h1><p>Earlier layout beside the current update. Tap an image for its full-size version.</p><p class="status">Screens are rendered UI captures with simulated account and generation responses. This gallery does not test live generation or Play Integrity. Final visual acceptance and release checks are pending.</p><p><a href="store.html">View all four store screenshots</a> · <a href="current-ui.html">View current UI individually</a></p><nav aria-label="Comparison cases">${records.map(r=>`<a href="#${r.id}">${r.title}</a>`).join('')}</nav>${records.map(r=>`<section id="${r.id}"><h2>${r.title}</h2><p class="note">${r.note}</p><div class="pair ${r.id==='desktop'?'desktop':''}">${r.sides.map(s=>`<figure><figcaption>${s.side==='before'?'Before':'After'}</figcaption><a href="before-after/${s.file}"><img src="before-after/${s.file}" width="${s.width}" height="${s.height}" alt="${r.title}, ${s.side}" loading="${r.id==='desktop'?'eager':'lazy'}"></a></figure>`).join('')}</div></section>`).join('')}</main></body></html>`;
await fs.writeFile(path.join(dir,'comparison-gallery.html'),html.replaceAll('../implemented/','../../../../mobile/assets/').replace('href="store.html"','href="../../../../marketing-assets/play-counter-cleanup-2026-10-04/gallery.html"').replace('href="current-ui.html"','href="gallery.html"'));
await fs.cp(output,path.join(preview,'before-after'),{recursive:true});
try { await fs.access(path.join(preview,'current-ui.html')); }
catch { await fs.copyFile(path.join(preview,'implemented.html'),path.join(preview,'current-ui.html')); }
await fs.writeFile(path.join(preview,'implemented.html'),html.replaceAll('../implemented/','implemented/'));
let store=await fs.readFile(path.join(preview,'store.html'),'utf8');store=store.replace('Review the app layout','Compare the UI before and after');await fs.writeFile(path.join(preview,'store.html'),store);
const browser=await chromium.launch({headless:true});
const checks=[];
try{
 for(const width of [390,320,1440]){
  const page=await browser.newPage({viewport:{width,height:900}});
  await page.goto(new URL('comparison-gallery.html',`file://${dir}/`).href);
  await page.evaluate(()=>document.fonts.ready);
  await page.evaluate(()=>{document.querySelectorAll('img').forEach(img=>img.loading='eager');});
  await page.waitForFunction(()=>[...document.images].every(img=>img.complete&&img.naturalWidth>0));
  const check=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,fonts:[...document.fonts].map(f=>({family:f.family,status:f.status})),images:[...document.images].map(img=>({src:img.getAttribute('src'),width:img.naturalWidth,visibleWidth:img.getBoundingClientRect().width})),pairs:[...document.querySelectorAll('.pair')].map(el=>{const [a,b]=[...el.children].map(e=>e.getBoundingClientRect());return{aligned:a.top===b.top,sideBySide:a.right<=b.left};})}));
  if(check.overflow||check.fonts.some(f=>f.status!=='loaded')||check.pairs.some(p=>!p.aligned||!p.sideBySide))throw Error(JSON.stringify(check));
  checks.push(check);
  if(width===390){await page.locator('#installed').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(dir,'before-after-phone.png')});}
  if(width===1440){await page.screenshot({path:path.join(dir,'before-after-desktop.png')});}
  await page.close();
 }
}finally{await browser.close();}
await fs.writeFile(path.join(dir,'comparison-manifest.json'),JSON.stringify({purpose:'Owner-requested side-by-side historical versus current UI review. Historical assets are not approved current marketing images.',status:'Agent visual review pending. Owner acceptance and publishing approval pending.',records,checks},null,2)+'\n');
console.log({cases:records.length,images:records.length*2,widths:checks.map(c=>c.width),overflow:false,fontsLoaded:true});
