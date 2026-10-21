import {chromium} from '../design-assets/terminal-exploded/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:process.env.TERMINAL_QA_BROWSER||undefined});
const page=await browser.newPage();await page.goto(process.env.TERMINAL_QA_URL||'http://127.0.0.1:43128');
const result=await page.evaluate(async()=>{
  const {initExplodedTerminal}=await import('/assets/terminal-exploded.mjs');
  const trigger=document.createElement('button');document.body.append(trigger);
  const preference=new EventTarget();preference.matches=true;
  let disposed=0,created=0;const updates=[];
  const controller=initExplodedTerminal({trigger,reducedMotion:preference,loadRenderer:async()=>({createTerminalRenderer:()=>{created++;return {select(){},resetView(){},setSeparation:v=>updates.push(v),dispose:()=>disposed++};}})});
  const dialog=[...document.querySelectorAll('.terminal-exploded')].at(-1);
  controller.open();await new Promise(r=>setTimeout(r,10));controller.close();controller.open();
  // The previous native close event may arrive after a new open.
  dialog.dispatchEvent(new Event('close'));
  const staleCloseSafe=dialog.open;
  // Pointer cancellation belongs to entry only, never the queued assembly reveal.
  trigger.dispatchEvent(new Event('pointerleave'));
  await new Promise(r=>setTimeout(r,10));controller.close();controller.destroy();trigger.remove();
  const trigger2=document.createElement('button');document.body.append(trigger2);let resolveModule,calls=0;
  const pending=new Promise(r=>resolveModule=r);
  const delayed=initExplodedTerminal({trigger:trigger2,reducedMotion:preference,loadRenderer:()=>pending});delayed.open();delayed.close();resolveModule({createTerminalRenderer(){calls++;return {dispose(){}};}});await new Promise(r=>setTimeout(r,10));delayed.destroy();trigger2.remove();
  const trigger3=document.createElement('button');document.body.append(trigger3);let attempts=0;
  const recovery=initExplodedTerminal({trigger:trigger3,reducedMotion:preference,loadRenderer:async()=>{if(++attempts===1)throw Error('Simulated asset failure');return {createTerminalRenderer:()=>({select(){},setSeparation(){},dispose(){}})};}});
  recovery.open();await new Promise(r=>setTimeout(r,10));const recoveryDialog=[...document.querySelectorAll('.terminal-exploded')].at(-1),failedDismissible=recoveryDialog.open&&recoveryDialog.dataset.state==='error'&&!recoveryDialog.querySelector('.te-error').hidden;
  recoveryDialog.querySelector('.te-retry').click();await new Promise(r=>setTimeout(r,10));const recovered=recoveryDialog.dataset.state==='ready';recovery.destroy();trigger3.remove();
  return {staleCloseSafe,disposed,created,updates,lateRendererCreations:calls,failedDismissible,recovered};
});
await browser.close();console.log(JSON.stringify(result));assert.equal(result.staleCloseSafe,true,'stale close events must not dismiss a newly opened assembly');assert.equal(result.created,result.disposed);assert.equal(result.lateRendererCreations,0);assert.equal(result.failedDismissible,true);assert.equal(result.recovered,true);
