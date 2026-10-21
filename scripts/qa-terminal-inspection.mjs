import {chromium} from '../design-assets/terminal-exploded/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const out=fileURLToPath(new URL('../design-assets/terminal-exploded/qa-inspection/',import.meta.url));await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.TERMINAL_QA_BROWSER});
const report={cases:[],errors:[]};
for(const [name,width,height,dpr] of [['desktop',1440,900,1],['phone',393,852,3],['preview',685,846,1],['small-phone',320,568,2],['landscape',844,390,2],['tablet',768,1024,2],['compact-desktop',1024,768,1],['wide',2560,1080,1]]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:dpr,hasTouch:width<1024});page.on('pageerror',e=>report.errors.push({name,message:e.message}));
  await page.goto(process.env.TERMINAL_QA_URL||'http://127.0.0.1:43128');await page.waitForSelector('.scene.is-ready');await page.waitForFunction(()=>getComputedStyle(document.querySelector('.experience')).opacity==='1');
  await page.locator('.pilot-light').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.terminal-exploded').dataset.state==='open');
  const containment=await page.evaluate(async()=>{const {partExtents,partTranslation}=await import('/assets/terminal-scene-motion.mjs'),mobile=matchMedia('(max-width:1023px)').matches,scale=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--scene-scale')),terminal=document.querySelector('.terminal').getBoundingClientRect(),travel=Number(document.querySelector('.te-parts-scene').dataset.travel),lift=Number(document.querySelector('.te-parts-scene').dataset.lift);return Object.entries(partExtents[mobile?'mobile':'desktop']).map(([id,[left,top,right,bottom]])=>{const pose=partTranslation(id,1,mobile);return {id,left:terminal.left+(left+pose.x*travel)*scale,top:terminal.top+(top+pose.y*travel+lift)*scale,right:terminal.left+(right+pose.x*travel)*scale,bottom:terminal.top+(bottom+pose.y*travel+lift)*scale};});});
  for(const box of containment){assert.ok(box.left>=-1&&box.top>=-1&&box.right<=width+1&&box.bottom<=height+1,JSON.stringify({name,box}));}
  await page.screenshot({path:out+name+'-open.png',scale:'css'});
  const targets=await page.evaluate(()=>{const result={};for(let y=2;y<innerHeight;y+=3)for(let x=2;x<innerWidth;x+=3){const e=document.elementFromPoint(x,y);if(e?.classList.contains('te-part-handle')){const id=e.parentElement.dataset.part;if(!result[id])result[id]={x,y};}}return result;});
  assert.deepEqual(Object.keys(targets).sort(),['board','display','housing','keys','rear']);
  for(const [id,p]of Object.entries(targets)){
    const handle=page.locator(`[data-part="${id}"] .te-part-handle`),group=page.locator(`[data-part="${id}"]`);
    // Keyboard positioning and reset work for every physical assembly.
    await handle.focus();await page.keyboard.press('ArrowRight');assert.ok(Number(await group.getAttribute('data-offset-x'))>0);await page.keyboard.press('Home');assert.equal(Number(await group.getAttribute('data-offset-x')),0);
    await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+18,p.y-12,{steps:6});await page.mouse.up();
    assert.ok(Number(await group.getAttribute('data-offset-x'))>0,id+' is not draggable');
    await handle.focus();await page.keyboard.press('Home');
  }
  if(name==='phone'){
    const session=await page.context().newCDPSession(page),p=targets.keys;
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y}]});
    for(let i=1;i<=6;i++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x+18*i/6,y:p.y-12*i/6}]});}
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.ok(Number(await page.locator('[data-part="keys"]').getAttribute('data-offset-x'))>0,'touch drag');await page.locator('[data-part="keys"] .te-part-handle').focus();await page.keyboard.press('Home');await session.detach();
  }
  // Keep a moved front enclosure, then close directly. All offsets must clear.
  const handle=page.locator('[data-part="housing"] .te-part-handle');await handle.focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowDown');await page.screenshot({path:out+name+'-inspected.png',scale:'css'});
  await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('.terminal-exploded').hidden);assert.equal(await page.locator('#terminal-display').evaluate(e=>e.inert),false);
  await page.locator('.pilot-light').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.terminal-exploded').dataset.state==='open');assert.equal(Number(await page.locator('[data-part="housing"]').getAttribute('data-offset-x')),0);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('.terminal-exploded').hidden);
  report.cases.push({name,width,height,dpr,reachableParts:Object.keys(targets),dragKeyboardAndReset:true});console.log('PASS '+name);await page.close();
}
await browser.close();await writeFile(out+'report.json',JSON.stringify(report,null,2));assert.equal(report.errors.length,0);
