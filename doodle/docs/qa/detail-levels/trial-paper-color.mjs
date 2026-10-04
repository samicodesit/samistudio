import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';

// Offline review only. Adapted from the existing marketing normalization script.
// No app imports, provider calls, scene edits, or writes to original assets.
const root = new URL('../../../', import.meta.url);
const sourceDir = new URL('docs/qa/detail-levels/comparisons/', root);
const outputDir = new URL('paper-color-trial/', sourceDir);
const gallery = new URL('.qa-phone-review/', root);
const target = [255, 235, 138];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const paper = (r,g,b) => r>170 && g>150 && r>=g-15 && g-b>20 && r-b>35;
const median = histogram => {
  const half = histogram.reduce((a,b)=>a+b,0)/2;
  let n=0;
  for (let i=0;i<256;i++) { n+=histogram[i]; if(n>=half) return i; }
  throw new Error('No paper samples');
};
const estimate = pixels => {
  const h=Array.from({length:3},()=>new Uint32Array(256));
  let samples=0;
  for(let i=0;i<pixels.length;i+=4) {
    if(!paper(...pixels.subarray(i,i+3))) continue;
    samples++;
    for(let c=0;c<3;c++) h[c][pixels[i+c]]++;
  }
  assert(samples>10000, 'Insufficient paper for this offline trial');
  return {rgb:h.map(median),samples};
};
const smooth = value => { const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t); };
const hex = rgb => '#'+rgb.map(c=>c.toString(16).padStart(2,'0')).join('').toUpperCase();
const names=['1-1-simple','1-1-medium','1-1-detailed','2-1-simple','2-1-medium','2-1-detailed'];
await mkdir(outputDir,{recursive:true});
await mkdir(new URL('colors/',gallery),{recursive:true});
const records=[];
const start=performance.now();
for(const name of names) {
  const source=new URL(name+'.png',sourceDir);
  const original=await readFile(source);
  const {data:before,info}=await sharp(original).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(info.width,1024); assert.equal(info.height,1024);
  const base=estimate(before);
  const after=Buffer.from(before);
  let changed=0, protectedPixels=0, clippedRed=0;
  for(let i=0;i<before.length;i+=4) {
    const [r,g,b]=before.subarray(i,i+3);
    if(r-b<12 || g-b<8 || Math.max(r,g,b)<120) continue;
    const weight=smooth((Math.min(r,g)-120)/(Math.min(base.rgb[0],base.rgb[1])-120));
    for(let c=0;c<3;c++) {
      const value=before[i+c]+(target[c]-base.rgb[c])*weight;
      if(c===0 && value>255) clippedRed++;
      after[i+c]=Math.max(0,Math.min(255,Math.round(value)));
    }
    if(!before.subarray(i,i+3).equals(after.subarray(i,i+3))) changed++;
  }
  const result=estimate(after);
  assert.deepEqual(result.rgb,target,'Measured paper median must reach target exactly');
  for(let i=0;i<before.length;i+=4) {
    assert.equal(after[i+3],before[i+3],'Alpha must stay exact');
    if(Math.max(...before.subarray(i,i+3))<120) {
      protectedPixels++;
      assert(before.subarray(i,i+4).equals(after.subarray(i,i+4)),'Dark ink must stay byte-identical');
    }
  }
  const corrected=await sharp(after,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();
  const decoded=await sharp(corrected).ensureAlpha().raw().toBuffer();
  assert(decoded.equals(after),'PNG export must preserve corrected pixels exactly');
  assert.equal(sha(await readFile(source)),sha(original),'Original must remain untouched');
  const output=new URL(name+'.png',outputDir);
  await writeFile(output,corrected);
  await copyFile(source,new URL(`colors/${name}-original.png`,gallery));
  await copyFile(output,new URL(`colors/${name}-corrected.png`,gallery));
  for(const [mode,bytes] of [['original',original],['corrected',corrected]]) {
    await sharp(bytes).resize(640,640).png().toFile(new URL(`colors/${name}-${mode}-preview.png`,gallery).pathname);
  }
  records.push({name,sourceSha256:sha(original),outputSha256:sha(corrected),width:info.width,height:info.height,before:base,after:result,changedPixels:changed,darkInkPixelsUnchanged:protectedPixels,alphaUnchanged:true,redChannelClippedPixels:clippedRed,bytes:corrected.length});
}
const manifest={createdAt:new Date().toISOString(),status:'Offline trial. Owner review pending. Not used by app or store asset.',target:'#FFEB8A',method:'Full-image yellow-paper median, additive RGB shift with smooth weighting near light ink; dark ink excluded. Adapted from existing marketing script.',limitations:'Exact sampled median, not every textured paper pixel. Bright red-channel values clip at 255. Light ink transitions can shift slightly. No guarantee for arbitrary future drawings.',elapsedMs:Math.round(performance.now()-start),records};
await writeFile(new URL('manifest.json',outputDir),JSON.stringify(manifest,null,2)+'\n');
const cards=records.map((r,i)=>`<section><h2>${i<3?'Cat holding a flower':'Friends baking pancakes'}: ${['Simple','Medium','Detailed'][i%3]}</h2><p class="measurement">Paper median: <span data-measure="${r.name}" data-before="${hex(r.before.rgb)}">#FFEB8A</span></p><a data-full="${r.name}" href="colors/${r.name}-corrected.png"><img data-image="${r.name}" src="colors/${r.name}-corrected-preview.png" width="640" height="640" alt="${i<3?'Cat holding a flower':'Friends baking pancakes'}, ${['simple','medium','detailed'][i%3]}" loading="${i?'lazy':'eager'}"></a><p class="hint">Tap drawing for full resolution.</p></section>`).join('\n');
await writeFile(new URL('colors.html',gallery),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Doodle paper color trial</title><style>*{box-sizing:border-box}body{margin:0;background:#EDF1E8;color:#22251F;font:16px/1.5 system-ui,sans-serif}main{max-width:640px;margin:auto;padding:16px}h1{font-size:25px;line-height:1.2}h2{font-size:18px}p{margin:8px 0 16px}nav{position:sticky;top:0;z-index:1;background:#EDF1E8;padding:12px 0;display:flex;gap:8px}button{flex:1;min-height:48px;border:1px solid #195D48;border-radius:8px;background:#EDF1E8;color:#195D48;font:inherit;font-weight:600;cursor:pointer}button[aria-pressed=true]{background:#195D48;color:white}button:focus-visible{outline:3px solid #22251F;outline-offset:2px}section{margin:0 0 32px}img{display:block;width:100%;height:auto;border-radius:12px}.measurement,.hint{font-size:14px}.hint{color:#555}a{color:#195D48}</style></head><body><main><h1>Paper color trial</h1><p>Six existing HIGH generations. These are corrected copies for review. The app and original drawings are unchanged.</p><p>The measured paper base reaches <strong>#FFEB8A</strong>. Grain remains, so individual pixels vary. Dark ink is preserved exactly; light transitions can shift slightly.</p><nav aria-label="Comparison"><button type="button" data-mode="original" aria-pressed="false">Original</button><button type="button" data-mode="corrected" aria-pressed="true">Corrected</button></nav><p id="mode" aria-live="polite">Showing corrected copies</p>${cards}<p><a href="/">Back to selector and store previews</a></p></main><script>document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{const mode=button.dataset.mode;document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));document.querySelectorAll('[data-image]').forEach(img=>img.src='colors/'+img.dataset.image+'-'+mode+'-preview.png');document.querySelectorAll('[data-full]').forEach(a=>a.href='colors/'+a.dataset.full+'-'+mode+'.png');document.querySelectorAll('[data-measure]').forEach(s=>s.textContent=mode==='original'?s.dataset.before:'#FFEB8A');document.getElementById('mode').textContent=mode==='original'?'Showing unchanged originals':'Showing corrected copies';}));</script></body></html>`);
console.log(JSON.stringify({elapsedMs:manifest.elapsedMs,records:records.map(r=>({name:r.name,before:hex(r.before.rgb),after:hex(r.after.rgb),darkInkPixelsUnchanged:r.darkInkPixelsUnchanged,redChannelClippedPixels:r.redChannelClippedPixels}))},null,2));
