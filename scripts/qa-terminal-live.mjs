import {chromium} from '../design-assets/terminal-exploded/node_modules/playwright/index.mjs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {studioFiles} from './build-studio.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),out=root+'design-assets/terminal-exploded/qa-live/';await mkdir(out,{recursive:true});
const base=process.env.TERMINAL_QA_URL||'https://samistudio.nl';
const report={url:base,date:new Date().toISOString(),assets:[],cases:[],errors:[]};
for(let i=0;i<studioFiles.length;i+=6){await Promise.all(studioFiles.slice(i,i+6).map(async file=>{const response=await fetch(base+'/'+file);const data=Buffer.from(await response.arrayBuffer()),local=await readFile(root+'dist/'+file),hash=b=>createHash('sha256').update(b).digest('hex');report.assets.push({file,status:response.status,matches:hash(data)===hash(local)});}));}
await writeFile(out+'report.json',JSON.stringify(report,null,2));assert.ok(report.assets.every(a=>a.status===200&&a.matches),JSON.stringify(report.assets.filter(a=>!a.matches||a.status!==200)));
const browser=await chromium.launch({headless:true,executablePath:process.env.TERMINAL_QA_BROWSER});
for(const [name,width,height]of [['desktop',1440,900],['phone',393,852],['preview',685,846]]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});page.on('pageerror',e=>report.errors.push({name,message:e.message}));await page.goto(base);await page.waitForSelector('.scene.is-ready');await page.waitForFunction(()=>getComputedStyle(document.querySelector('.experience')).opacity==='1');await page.waitForTimeout(800);await page.mouse.move(0,0);await page.screenshot({path:out+name+'-home.png'});
  const backdrop=await page.locator('.scene-extension').evaluate(e=>e.toDataURL());await page.locator('.pilot-light').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.terminal-exploded').dataset.state==='open');await page.screenshot({path:out+name+'-open.png'});assert.equal(await page.locator('.scene-extension').evaluate(e=>e.toDataURL()),backdrop);
  const target=await page.evaluate(()=>{for(let y=2;y<innerHeight;y+=3)for(let x=2;x<innerWidth;x+=3){const e=document.elementFromPoint(x,y);if(e?.classList.contains('te-part-handle')&&e.parentElement.dataset.part==='housing')return {x,y};}});assert.ok(target);await page.mouse.move(target.x,target.y);await page.mouse.down();await page.mouse.move(target.x+18,target.y-12,{steps:6});await page.mouse.up();assert.ok(Number(await page.locator('[data-part="housing"]').getAttribute('data-offset-x'))>0);
  await page.screenshot({path:out+name+'-inspected.png'});await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('.terminal-exploded').hidden);await page.mouse.click(0,0);await page.mouse.move(0,0);await page.screenshot({path:out+name+'-restored.png'});
  await page.locator('#terminal-display .work-row:not([hidden])').click();await page.waitForSelector('#project-gallery[open]');await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#project-gallery').open);
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('.pilot-light').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.terminal-exploded').dataset.state==='open');assert.equal(await page.locator('.terminal-exploded').getAttribute('data-progress'),'1.0000');await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('.terminal-exploded').hidden);
  report.cases.push({name,openDragRestoreGalleryAndReducedMotion:true});console.log('PASS live '+name);await page.close();
}
await browser.close();await writeFile(out+'report.json',JSON.stringify(report,null,2));assert.equal(report.errors.length,0);console.log('Verified '+report.assets.length+' production files');
