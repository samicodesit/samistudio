import {chromium} from '../design-assets/terminal-exploded/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:process.env.TERMINAL_QA_BROWSER||undefined});
const page=await browser.newPage();await page.goto(process.env.TERMINAL_QA_URL||'http://127.0.0.1:43128');
const result=await page.evaluate(async()=>{
  const {initExplodedTerminal}=await import('/assets/terminal-exploded.mjs');
  const preference=new EventTarget();preference.matches=true;
  const trigger=document.createElement('button');document.body.append(trigger);
  let resolveModule,created=0,activated=0,restored=0,disposed=0;
  const module=new Promise(resolve=>resolveModule=resolve);
  const controller=initExplodedTerminal({trigger,reducedMotion:preference,loadRenderer:()=>module});
  const opening=controller.open();controller.close({immediate:true});
  resolveModule({createTerminalRenderer:({mobile})=>{created++;return {mobile,activate(){activated++;},restore(){restored++;},refresh(){},render(){},dispose(){disposed++;}};}});await opening;
  const cancelledBeforeActivation=activated===0&&!controller.isOpen;
  for(let i=0;i<5;i++){await controller.open();controller.close({immediate:true});}
  const reusedSingleRenderer=created===1&&activated===5&&restored===5;controller.destroy();trigger.remove();
  const trigger2=document.createElement('button');document.body.append(trigger2);let attempts=0;
  const retry=initExplodedTerminal({trigger:trigger2,reducedMotion:preference,loadRenderer:async()=>{if(++attempts===1)throw Error('Simulated unavailable asset');return {createTerminalRenderer:({mobile})=>({mobile,activate(){},restore(){},render(){},dispose(){}})};}});
  await retry.open();const failureLeavesHomepageUsable=!retry.isOpen;await retry.open();const retryWorks=retry.isOpen;retry.destroy();trigger2.remove();
  return {cancelledBeforeActivation,reusedSingleRenderer,created,disposed,failureLeavesHomepageUsable,retryWorks};
});
await browser.close();console.log(JSON.stringify(result));await writeFile(fileURLToPath(new URL('../design-assets/terminal-exploded/qa-scene/lifecycle-report.json',import.meta.url)),JSON.stringify(result,null,2));
assert.equal(result.cancelledBeforeActivation,true);assert.equal(result.reusedSingleRenderer,true);assert.equal(result.created,result.disposed);assert.equal(result.failureLeavesHomepageUsable,true);assert.equal(result.retryWorks,true);
