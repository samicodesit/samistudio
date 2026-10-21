import {chromium} from '../design-assets/terminal-exploded/node_modules/playwright/index.mjs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const out=fileURLToPath(new URL('../design-assets/terminal-exploded/qa-release/',import.meta.url));
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.TERMINAL_QA_BROWSER});
const results={errors:[],surfaces:[],assets:[]};
const ready=async page=>{await page.waitForSelector('.scene.is-ready');await page.waitForFunction(()=>!document.documentElement.classList.contains('is-loading')&&getComputedStyle(document.querySelector('.experience')).opacity==='1');await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(800);};
for(const [name,viewport] of [['desktop',{width:1440,height:900}],['phone',{width:393,height:852}],['preview',{width:685,height:846}]]){
  for(const [source,url] of [['live','https://samistudio.nl'],['local','http://127.0.0.1:43128']]){
    const page=await browser.newPage({viewport,deviceScaleFactor:1});page.on('pageerror',e=>results.errors.push({name,source,message:e.message}));
    await page.goto(url);await ready(page);await page.mouse.move(0,0);
    for(const screen of ['work','about','contact']){
      if(screen!=='work'){await page.locator('.key[data-view="'+screen+'"]').click();await page.mouse.move(0,0);await page.waitForTimeout(500);}
      await page.screenshot({path:out+name+'-'+source+'-'+screen+'.png'});
    }
    results.surfaces.push({name,source,url});await page.close();
  }
}
const page=await browser.newPage({viewport:{width:1440,height:900}});await page.goto('http://127.0.0.1:43128');await ready(page);
await page.locator('.pilot-light').focus();await page.waitForTimeout(500);await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+100));await page.keyboard.press('Enter');await page.clock.runFor(1800);await page.keyboard.press('Escape');
let previous=0;results.closing=[];
for(const time of [0,100,300,500,700,900,1100,1300,1500,1800]){await page.clock.runFor(time-previous);previous=time;await page.screenshot({path:out+'closing-'+time+'.png'});results.closing.push({time,...await page.locator('.terminal-exploded').evaluate(e=>({progress:e.dataset.progress,state:e.dataset.state,hidden:e.hidden}))});}
await page.close();await browser.close();
const {studioFiles}=await import('./build-studio.mjs');
for(const file of studioFiles){const response=await fetch('https://samistudio.nl/'+file);const bytes=Buffer.from(await response.arrayBuffer());const local=await readFile(fileURLToPath(new URL('../'+file,import.meta.url)));const hash=data=>createHash('sha256').update(data).digest('hex');results.assets.push({file,status:response.status,matches:hash(bytes)===hash(local),liveHash:hash(bytes),localHash:hash(local)});}
await writeFile(out+'baseline-report.json',JSON.stringify(results,null,2));console.log(JSON.stringify({surfaces:results.surfaces.length,errors:results.errors,changedAssets:results.assets.filter(x=>!x.matches).map(x=>x.file),closing:results.closing},null,2));
