import {chromium} from '../design-assets/terminal-exploded/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const output=fileURLToPath(new URL('../design-assets/terminal-exploded/qa-scene/',import.meta.url));await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.TERMINAL_QA_BROWSER||undefined});
const report={cases:[],errors:[]};
for(const [name,viewport]of [['desktop',{width:1440,height:900}],['phone',{width:393,height:852}],['preview',{width:685,height:846}]]){
  const page=await browser.newPage({viewport,deviceScaleFactor:1,recordVideo:{dir:output,size:viewport}});page.on('pageerror',error=>report.errors.push(error.message));
  await page.goto(process.env.TERMINAL_QA_URL||'http://127.0.0.1:43128');await page.waitForSelector('.scene.is-ready');await page.waitForFunction(()=>!document.documentElement.classList.contains('is-loading'));
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.experience')).opacity==='1');
  await page.locator('.pilot-light').focus();await page.waitForSelector('.te-reference',{state:'attached'});await page.waitForTimeout(150);
  await page.clock.install({time:new Date('2026-10-21T12:00:00Z')});await page.clock.pauseAt(new Date('2026-10-21T12:00:01Z'));
  const before=await page.evaluate(()=>({backdrop:document.querySelector('.scene-extension').toDataURL(),headline:document.querySelector('#headline').getBoundingClientRect().toJSON(),display:document.querySelector('#terminal-display').getBoundingClientRect().toJSON(),keys:[...document.querySelectorAll('.key')].map(e=>e.getBoundingClientRect().toJSON())}));
  await page.screenshot({path:output+name+'-home.png'});
  await page.keyboard.press('Enter');await page.screenshot({path:output+name+'-handoff.png'});
  const handoff=await page.evaluate(()=>({display:document.querySelector('#terminal-display').getBoundingClientRect().toJSON(),keys:[...document.querySelectorAll('.key')].map(e=>e.getBoundingClientRect().toJSON())}));
  assert.deepEqual(handoff.display,before.display);assert.deepEqual(handoff.keys,before.keys);
  for(const [i,step]of [32,64,100,200,300,900].entries()){await page.clock.runFor(step);await page.screenshot({path:output+name+'-motion-'+i+'.png'});}
  assert.equal(await page.locator('.terminal-exploded').getAttribute('data-state'),'open');
  await page.screenshot({path:output+name+'-open.png'});
  assert.equal(await page.locator('.terminal-exploded').getAttribute('role'),null);assert.equal(await page.locator('.terminal-exploded h2').count(),0);
  const live=await page.evaluate(()=>({displayCount:document.querySelectorAll('#terminal-display').length,keyCount:document.querySelectorAll('.key').length,headline:document.querySelector('#headline').getBoundingClientRect().toJSON(),scene:document.querySelector('.scene-extension').toDataURL()}));
  assert.equal(live.displayCount,1);assert.equal(live.keyCount,3);
  assert.equal(live.scene,before.backdrop);assert.deepEqual(live.headline,before.headline);
  await page.keyboard.press('Escape');await page.clock.runFor(1800);assert.equal(await page.locator('.terminal-exploded').evaluate(e=>e.hidden),true);await page.screenshot({path:output+name+'-restored.png'});
  // Reverse twice without snapping to either endpoint.
  await page.keyboard.press('Enter');await page.clock.runFor(130);const opening=Number(await page.locator('.terminal-exploded').getAttribute('data-progress'));
  await page.keyboard.press('Escape');await page.clock.runFor(16);const reversing=Number(await page.locator('.terminal-exploded').getAttribute('data-progress'));assert.ok(Math.abs(reversing-opening)<.06);
  await page.locator('.pilot-light').press('Enter');await page.clock.runFor(1700);assert.equal(await page.locator('.terminal-exploded').getAttribute('data-state'),'open');
  await page.keyboard.press('Escape');await page.clock.runFor(1700);assert.equal(await page.locator('.terminal-exploded').evaluate(e=>e.hidden),true);
  assert.equal(await page.locator('.te-parts-scene').count(),1);assert.equal(await page.locator('#terminal-display').count(),1);
  report.cases.push({name,pass:true});console.log('PASS '+name);
  const video=page.video();await page.close();await video.saveAs(output+name+'-motion.webm');await video.delete();
}
async function scenario(name,fn){const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>report.errors.push(e.message));await page.goto(process.env.TERMINAL_QA_URL||'http://127.0.0.1:43128');await page.waitForSelector('.scene.is-ready');await page.waitForFunction(()=>!document.documentElement.classList.contains('is-loading')&&getComputedStyle(document.querySelector('.experience')).opacity==='1');try{await fn(page);report.cases.push({name,pass:true});console.log('PASS '+name);}finally{await page.close();}}
const isOpen=page=>page.waitForFunction(()=>document.querySelector('.terminal-exploded').dataset.state==='open');
const isClosed=page=>page.waitForFunction(()=>document.querySelector('.terminal-exploded').hidden);
await scenario('pointer hold, release, cancellation and repeated entry',async page=>{
  let b=await page.locator('.pilot-light').boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);await page.waitForTimeout(760);assert.equal(await page.locator('.terminal-exploded').evaluate(e=>e.hidden),true);
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+40,b.y+40);await page.waitForTimeout(760);await page.mouse.up();assert.equal(await page.locator('.terminal-exploded').evaluate(e=>e.hidden),true);
  b=await page.locator('.pilot-light').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.waitForTimeout(760);await page.mouse.up();await isOpen(page);
  await page.locator('.pilot-light').click();await isClosed(page);await page.locator('.pilot-light').focus();await page.keyboard.press('Enter');await isOpen(page);await page.keyboard.press('Escape');await isClosed(page);assert.equal(await page.locator('.te-parts-scene').count(),1);
});
await scenario('reduced motion keeps the same scene and settles immediately',async page=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('.pilot-light').focus();await page.keyboard.press('Enter');await isOpen(page);assert.equal(await page.locator('.terminal-exploded').getAttribute('data-progress'),'1.0000');await page.keyboard.press('Escape');await isClosed(page);
});
await scenario('playground state and the existing project gallery survive the teardown',async page=>{
  await page.keyboard.press('Backquote');await page.locator('#terminal-display .shell-input').fill('2 ** 10');await page.locator('#terminal-display .shell-input').press('Enter');await page.waitForFunction(()=>document.querySelector('.shell-output').textContent.includes('1024'));
  await page.locator('#terminal-display .shell-input').fill('explode');await page.locator('#terminal-display .shell-input').press('Enter');await isOpen(page);await page.keyboard.press('Escape');await isClosed(page);assert.equal(await page.locator('#terminal-display').getAttribute('data-shell'),'true');assert.match(await page.locator('.shell-output').textContent(),/1024/);await page.keyboard.press('Escape');
  await page.locator('#terminal-display .work-row:not([hidden])').click();await page.waitForSelector('#project-gallery[open]');await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#project-gallery').open);
});
await writeFile(output+'report.json',JSON.stringify(report,null,2));await browser.close();assert.equal(report.errors.length,0,report.errors.join('\n'));
