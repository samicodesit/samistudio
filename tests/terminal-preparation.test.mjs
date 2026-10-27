import {test} from 'node:test';
import assert from 'node:assert/strict';
import {waitForTerminalHome} from '../assets/terminal-photo-renderer.mjs';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const studioSource=await readFile(new URL('../assets/studio.js',import.meta.url),'utf8');
function progressFixture(){
 const start=studioSource.indexOf('export function createLoadingProgress(');
 assert.ok(start>=0,'The loader needs a completed-work progress model');
 const code=studioSource.slice(start,studioSource.indexOf('\n(() =>',start)).replace('export function','function');
 const context={};vm.runInNewContext(code+'\nthis.create=createLoadingProgress;',context);const values=[];
 return {progress:context.create(v=>values.push(v)),values};
}
test('loading progress advances only for completed work and never reverses or double counts',()=>{
 const {progress,values}=progressFixture();assert.equal(values.at(-1),0);
 progress.set('fonts');const fonts=values.at(-1);assert.ok(fonts>0&&fonts<1);
 progress.set('fonts');assert.equal(values.at(-1),fonts);
 progress.set('gallery',.5);const halfway=values.at(-1);assert.ok(halfway>fonts);
 progress.set('gallery',.2);assert.equal(values.at(-1),halfway);
 progress.set('gallery',1);assert.ok(values.at(-1)>halfway);
 const before=values.at(-1);progress.set('unknown');progress.set('scene',NaN);assert.equal(values.at(-1),before);
 progress.finish();assert.equal(values.at(-1),1);progress.set('scene');assert.equal(values.at(-1),1);
});
test('all preparation milestones reserve full ink for the actual readiness handoff',()=>{
 const {progress,values}=progressFixture();
 for(const phase of ['fonts','artwork','scene','audio','gallery','photographicRenderer','environment','textures','geometry','bindings','roomField','shaders','interiorRestFrames','gpuWarm'])progress.set(phase);
 assert.ok(values.at(-1)>.95&&values.at(-1)<1,'Completed preparation cannot claim the final handoff early');
 progress.finish();assert.equal(values.at(-1),1);assert.ok(values.every((v,i)=>!i||v>=values[i-1]));
});
test('background terminal preparation waits until the visible modal has fully closed',async()=>{
 const modal=new EventTarget();let open=true,prepared=false;
 const pending=waitForTerminalHome({querySelector:()=>open?modal:null}).then(()=>prepared=true);
 await Promise.resolve();assert.equal(prepared,false);open=false;modal.dispatchEvent(new Event('close'));await pending;assert.equal(prepared,true);
});
test('background terminal preparation also waits if another modal takes its place',async()=>{
 const first=new EventTarget(),second=new EventTarget();let active=first,prepared=false;
 const pending=waitForTerminalHome({querySelector:()=>active}).then(()=>prepared=true);
 active=second;first.dispatchEvent(new Event('close'));await Promise.resolve();assert.equal(prepared,false);
 active=null;second.dispatchEvent(new Event('close'));await pending;assert.equal(prepared,true);
});
