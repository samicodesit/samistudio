import sharp from 'sharp';
import { chromium } from '@playwright/test';
import { readFile,writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const root=new URL('../../../',import.meta.url);
const comparison=new URL('docs/qa/detail-levels/comparisons/',root);
const output=new URL('paper-color-trial/',comparison);
const baseUrl=process.argv.find(arg=>arg.startsWith('https://')) ?? 'https://doodle-layout-review.vercel.app';
const manifest=JSON.parse(await readFile(new URL('manifest.json',output),'utf8'));
const composite=[];
for(const [i,r] of manifest.records.entries()) {
  for(const [j,url] of [new URL(r.name+'.png',comparison),new URL(r.name+'.png',output)].entries()) {
    const resized=await sharp(await readFile(url)).resize(320,320).png().toBuffer();
    composite.push({input:resized,left:j*320,top:i*346+26});
  }
  const text=Buffer.from(`<svg width="640" height="26"><rect width="640" height="26" fill="#EDF1E8"/><text x="8" y="19" font-family="sans-serif" font-size="15">${r.name} original</text><text x="328" y="19" font-family="sans-serif" font-size="15">corrected</text></svg>`);
  composite.push({input:text,left:0,top:i*346});
}
await sharp({create:{width:640,height:2076,channels:3,background:'#EDF1E8'}}).composite(composite).png().toFile(new URL('contact-sheet.png',output).pathname);
if(!process.argv.includes('--live')) { console.log('Contact sheet prepared');process.exit(0); }
const browser=await chromium.launch({headless:true});
const checks=[];
for(const width of [320,390]) {
  const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:1});
  const response=await page.goto(baseUrl+'/colors.html');
  assert.equal(response.status(),200);
  for(const mode of ['corrected','original','corrected']) {
    await page.getByRole('button',{name:mode==='corrected'?'Corrected':'Original',exact:true}).click();
    for(const img of await page.locator('img').all()) {
      await img.scrollIntoViewIfNeeded();
      await img.evaluate(img=>img.decode());
      assert(await img.evaluate(img=>img.complete && img.naturalWidth===640));
      assert((await img.getAttribute('src')).includes('-'+mode+'-preview.png'));
    }
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.equal(await page.locator('button[aria-pressed=true]').count(),1);
  }
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:new URL(`live-${width}.png`,output).pathname,fullPage:true});
  checks.push({width,anonymousHttp:response.status(),sixImagesDecoded:true,togglesVerified:true,noHorizontalOverflow:true});
  await page.close();
}
await browser.close();
for(const record of manifest.records) {
  const response=await fetch(`${baseUrl}/colors/${record.name}-corrected.png`);
  assert.equal(response.status,200);
  const hash=createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
  assert.equal(hash,record.outputSha256);
}
const result={verifiedAt:new Date().toISOString(),url:baseUrl+'/colors.html',checks,sixFullResolutionRemoteHashesMatch:true};
await writeFile(new URL('browser-verification.json',output),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
