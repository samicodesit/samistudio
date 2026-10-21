import {chromium} from '../design-assets/terminal-exploded/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const output=fileURLToPath(new URL('../design-assets/terminal-exploded/qa/',import.meta.url));
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.TERMINAL_QA_BROWSER||undefined,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const base=process.env.TERMINAL_QA_URL||'http://127.0.0.1:43128';
const report={cases:[],errors:[],requests:[]};
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
page.on('pageerror',e=>report.errors.push(e.message));
page.on('console',m=>{if(['error','warning'].includes(m.type()))console.log(m.type()+': '+m.text());});
page.on('request',r=>report.requests.push(r.url()));
async function check(name,fn){try{await fn();report.cases.push({name,pass:true});console.log('PASS '+name);}catch(e){report.cases.push({name,pass:false,error:e.message});console.log('FAIL '+name+': '+e.message);console.log(await page.evaluate(()=>({open:document.querySelector('.terminal-exploded')?.open,state:document.querySelector('.terminal-exploded')?.dataset.state,progress:document.querySelector('.te-stage canvas')?.dataset.separation,focus:document.activeElement?.outerHTML.slice(0,200)})));await page.screenshot({path:output+'failure.png'});}}
async function ready(){await page.goto(base);await page.waitForSelector('.scene.is-ready');await page.waitForFunction(()=>!document.documentElement.classList.contains('is-loading'));}
async function open(){await page.locator('.pilot-light').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.terminal-exploded').open);await page.waitForFunction(()=>['ready','error'].includes(document.querySelector('.terminal-exploded').dataset.state));assert.equal(await page.locator('.terminal-exploded').getAttribute('data-state'),'ready');await page.waitForFunction(()=>document.querySelector('.te-stage canvas').dataset.separation==='1.000');}
await check('renderer stays unloaded before entry',async()=>{await ready();assert.ok(!report.requests.some(u=>u.includes('terminal-renderer')||u.includes('terminal-construction')));});
await check('desktop keyboard entry and exploded composition',async()=>{await open();await page.screenshot({path:output+'desktop-exploded.png'});assert.equal(await page.locator('.te-parts button').count(),5);});
await check('reassemble and slider are reversible',async()=>{
  await page.locator('.te-assemble').click();await page.waitForFunction(()=>document.querySelector('.te-stage canvas').dataset.separation==='0.000');
  await page.screenshot({path:output+'desktop-assembled.png'});
  await page.locator('#te-range').fill('48');assert.equal(await page.locator('#te-range').getAttribute('aria-valuetext'),'48 percent separated');
  await page.locator('.te-assemble').click();await page.waitForFunction(()=>document.querySelector('.te-stage canvas').dataset.separation==='0.000');
});
await check('part descriptions and Escape focus return',async()=>{await page.locator('[data-part="board"]').click();assert.match(await page.locator('.te-part-copy').textContent(),/switches/);await page.keyboard.press('Escape');assert.equal(await page.locator('.terminal-exploded').evaluate(e=>e.open),false);assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('pilot-light')),true);});
await check('phone portrait composition',async()=>{await page.setViewportSize({width:393,height:852});await open();await page.screenshot({path:output+'phone-exploded.png'});const r=await page.locator('.te-stage').boundingBox();assert.ok(r.height>220);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.keyboard.press('Escape');});
await check('phone landscape composition',async()=>{await page.setViewportSize({width:844,height:390});await open();await page.screenshot({path:output+'landscape-exploded.png'});const r=await page.locator('.te-stage').boundingBox();assert.ok(r.height>160);await page.keyboard.press('Escape');});
await check('pointer hold opens and releasing it cannot cancel the reveal',async()=>{
  await page.setViewportSize({width:1440,height:900});await page.waitForFunction(()=>document.querySelector('.scene-photo').dataset.asset==='desktop');
  const b=await page.locator('.pilot-light').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.waitForTimeout(760);await page.mouse.up();
  await page.waitForFunction(()=>document.querySelector('.terminal-exploded').open&&document.querySelector('.te-stage canvas').dataset.separation==='1.000');await page.screenshot({path:output+'desktop-exploded.png'});await page.keyboard.press('Escape');
});
await check('short taps and moved holds preserve normal terminal navigation',async()=>{
  const b=await page.locator('.pilot-light').boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);await page.waitForTimeout(780);assert.equal(await page.locator('.terminal-exploded').evaluate(e=>e.open),false);
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+30,b.y+30);await page.waitForTimeout(780);await page.mouse.up();assert.equal(await page.locator('.terminal-exploded').evaluate(e=>e.open),false);
});
await check('REPL command preserves its screen and restores focus without opening a keyboard',async()=>{
  await page.keyboard.press('Backquote');await page.waitForSelector('#terminal-display[data-shell=true]');await page.locator('#terminal-display .shell-input').fill('explode');await page.locator('#terminal-display .shell-input').press('Enter');
  await page.waitForFunction(()=>document.querySelector('.terminal-exploded').open&&document.querySelector('.te-stage canvas').dataset.separation==='1.000');await page.keyboard.press('Escape');
  assert.equal(await page.locator('#terminal-display').getAttribute('data-shell'),'true');assert.equal(await page.evaluate(()=>document.activeElement.id),'display-title');await page.keyboard.press('Escape');assert.equal(await page.locator('#terminal-display').getAttribute('data-shell'),null);
});
await check('part inspection, responsive resizing and native modal keyboard focus',async()=>{
  await open();await page.locator('[data-part="keys"]').click();await page.waitForFunction(()=>{const d=document.querySelector('.te-stage canvas').dataset;return d.inspect==='true'&&d.moving==='false';});assert.equal(await page.locator('.te-stage>canvas:first-child').getAttribute('data-inspect'),'true');
  await page.locator('.te-reset').click();await page.waitForFunction(()=>{const d=document.querySelector('.te-stage canvas').dataset;return d.inspect==='false'&&d.moving==='false';});
  for(let i=0;i<14;i++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.closest('.terminal-exploded')!==null),true);}
  await page.setViewportSize({width:320,height:568});await page.waitForTimeout(150);await page.screenshot({path:output+'small-phone-exploded.png'});assert.equal(await page.locator('.terminal-exploded').evaluate(e=>e.scrollHeight<=e.clientHeight+1),true);await page.keyboard.press('Escape');
});
await check('reduced motion settles immediately and does not leave a running animation',async()=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:393,height:852});await open();assert.equal(await page.locator('.te-stage>canvas:first-child').getAttribute('data-moving'),'false');
  await page.locator('[data-part="board"]').click();await page.waitForTimeout(40);assert.equal(await page.locator('.te-stage>canvas:first-child').getAttribute('data-moving'),'false');await page.screenshot({path:output+'phone-board-inspection.png'});await page.keyboard.press('Escape');await page.emulateMedia({reducedMotion:'no-preference'});
});
await check('the existing project gallery still opens and returns',async()=>{
  await page.setViewportSize({width:1440,height:900});await page.locator('#terminal-display .work-row:not([hidden])').click();await page.waitForSelector('#project-gallery[open]');await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#project-gallery').open);
});
await check('runtime requests are local and no renderer errors were raised',async()=>{assert.equal(report.errors.length,0);assert.ok(report.requests.every(u=>u.startsWith(base)||u.startsWith('data:')||u.startsWith('blob:')));});
await writeFile(output+'report.json',JSON.stringify(report,null,2));
await browser.close();
if(report.cases.some(c=>!c.pass)||report.errors.length)process.exitCode=1;
