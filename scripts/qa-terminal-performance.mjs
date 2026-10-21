import {chromium} from '../design-assets/terminal-exploded/node_modules/playwright/index.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const out=fileURLToPath(new URL('../design-assets/terminal-exploded/qa-release/',import.meta.url));await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.TERMINAL_QA_BROWSER});const report=[];
for(const [name,width,height,dpr]of [['desktop',1440,900,1],['phone',393,852,2]]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:dpr});await page.goto(process.env.TERMINAL_QA_URL||'http://127.0.0.1:43128');await page.waitForSelector('.scene.is-ready');await page.waitForFunction(()=>getComputedStyle(document.querySelector('.experience')).opacity==='1');
  const session=await page.context().newCDPSession(page);await session.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.locator('.pilot-light').focus();await page.waitForSelector('.te-reference',{state:'attached'});
  await page.evaluate(()=>{window.motionFrames=[];window.motionTasks=[];let previous=0;new PerformanceObserver(list=>{for(const e of list.getEntries())if(document.querySelector('.terminal-exploded')?.dataset.moving==='true')window.motionTasks.push(e.duration);}).observe({type:'longtask',buffered:false});function tick(time){const moving=document.querySelector('.terminal-exploded')?.dataset.moving==='true';if(moving&&previous)window.motionFrames.push(time-previous);previous=moving?time:0;requestAnimationFrame(tick);}requestAnimationFrame(tick);});
  await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.terminal-exploded').dataset.state==='open');await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('.terminal-exploded').hidden);
  const values=await page.evaluate(()=>({frames:window.motionFrames,tasks:window.motionTasks}));values.frames.sort((a,b)=>a-b);const result={name,cpuSlowdown:4,frames:values.frames.length,p95FrameMs:values.frames[Math.floor(values.frames.length*.95)],maxFrameMs:Math.max(...values.frames),longTasks:values.tasks};report.push(result);console.log(JSON.stringify(result));assert.ok(result.frames>30);assert.ok(result.p95FrameMs<35,'sustained motion drops below 30fps');assert.ok(result.maxFrameMs<120,'visible motion stall');await page.close();
}
await browser.close();await writeFile(out+'performance-report.json',JSON.stringify(report,null,2));
