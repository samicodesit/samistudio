import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as terminal from '../assets/terminal-controls.mjs';

class Target extends EventTarget { hidden=false; }
function fixture({reduced=false,visible=true}={}) {
  assert.equal(typeof terminal.initTerminalReflection,'function');
  const page=new Target(),container=new Target(),media=new Target();media.matches=reduced;
  const timers=new Map(),runs=[];let timerId=0;
  const surface={dataset:{},animate(frames,options){let resolve,reject;const finished=new Promise((a,b)=>{resolve=a;reject=b;});
    const animation={finished,cancelled:false,cancel(){this.cancelled=true;reject(new Error('cancelled'));},finish:resolve};runs.push({frames,options,animation});return animation;}};
  const controller=terminal.initTerminalReflection({surface,container,page,reducedMotion:media,isVisible:()=>visible,
    setTimer(fn,delay){timers.set(++timerId,{fn,delay});return timerId;},clearTimer(id){timers.delete(id);}});
  const fire=(target,type,details={})=>{const event=new Event(type);Object.assign(event,details);target.dispatchEvent(event);};
  const runTimer=()=>{assert.equal(timers.size,1);const [id,timer]=[...timers][0];timers.delete(id);timer.fn();};
  return {page,container,media,timers,runs,controller,fire,runTimer,setVisible(value){visible=value;controller.refresh();}};
}

test('terminal glass waits for readiness, sweeps once, then rests between passes',async()=>{
  const f=fixture();assert.equal(f.timers.size,0);f.controller.ready();
  assert.equal([...f.timers.values()][0].delay,2500);f.runTimer();
  assert.equal(f.runs.length,1);assert.equal(f.runs[0].options.duration,3200);
  assert.equal(f.runs[0].options.iterations,1);assert.equal(f.timers.size,0);
  f.runs[0].animation.finish();await Promise.resolve();
  assert.equal([...f.timers.values()][0].delay,12800);
  assert.equal(f.runs[0].frames[0].opacity,0);assert.equal(f.runs[0].frames.at(-1).opacity,0);
});

test('touch and keyboard holds cancel glass motion and postpone the next pass until release',async()=>{
  const f=fixture();f.controller.ready();f.runTimer();
  f.fire(f.container,'pointerdown',{pointerId:7});
  assert.equal(f.runs[0].animation.cancelled,true);assert.equal(f.timers.size,0);
  f.fire(f.page,'pointerup',{pointerId:7});assert.equal([...f.timers.values()][0].delay,6500);
  f.fire(f.container,'keydown',{key:'Enter'});assert.equal(f.timers.size,0);
  f.fire(f.page,'keyup',{key:'Enter'});assert.equal([...f.timers.values()][0].delay,6500);
  await Promise.resolve();assert.equal(f.runs.length,1);
});

test('hidden tabs and covered or offscreen terminals keep no animation or pending timer',async()=>{
  const f=fixture();f.controller.ready();f.setVisible(false);assert.equal(f.timers.size,0);
  f.setVisible(true);f.runTimer();f.page.hidden=true;f.fire(f.page,'visibilitychange');
  assert.equal(f.runs[0].animation.cancelled,true);assert.equal(f.timers.size,0);
  f.page.hidden=false;f.fire(f.page,'visibilitychange');
  assert.equal([...f.timers.values()][0].delay,6500);await Promise.resolve();
});

test('reduced motion disables the reflection initially and when preferences change live',async()=>{
  const f=fixture({reduced:true});f.controller.ready();assert.equal(f.timers.size,0);
  f.media.matches=false;f.fire(f.media,'change');f.runTimer();
  f.media.matches=true;f.fire(f.media,'change');
  assert.equal(f.runs[0].animation.cancelled,true);assert.equal(f.timers.size,0);await Promise.resolve();
});

test('disposing the glass controller cancels pending work and detaches interaction listeners',()=>{
  const f=fixture();f.controller.ready();f.controller.destroy();
  f.fire(f.container,'pointerdown',{pointerId:1});f.fire(f.page,'pointerup',{pointerId:1});f.controller.refresh();
  assert.equal(f.timers.size,0);assert.equal(f.runs.length,0);
});
