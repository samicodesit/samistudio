import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initTerminalControls, initPaginationCue } from '../assets/terminal-controls.mjs';

class Element {
  constructor(){this.hidden=false;this.dataset={};this.attrs={};this.nodes=new Map();this.handlers=new Map();this.classes=new Set();this.classList={add:name=>this.classes.add(name),remove:name=>this.classes.delete(name),contains:name=>this.classes.has(name)};}
  querySelector(s){if(!this.nodes.has(s))this.nodes.set(s,new Element());return this.nodes.get(s);}
  addEventListener(s,fn,options){this.handlers.set(s+(options===true?':capture':''),fn);}
  fire(s,e={}){this.handlers.get(s)?.(e);}
  setAttribute(k,v){this.attrs[k]=v;}
  getBoundingClientRect(){return {width:273};}
  closest(){return null;}
  focus(){}
  animate(){this.animations=(this.animations||0)+1;return {cancel(){}};}
}

function cueFixture({reduced=false,visible=true}={}){
 const page=new EventTarget(),motion=new EventTarget();page.hidden=false;motion.matches=reduced;
 const calls=[],timers=new Map();let id=0,cancelled=0;
 const pagination={dataset:{},contains:()=>false,querySelectorAll:()=>[0,1].map(arrow=>({animate:(frames,options)=>{calls.push({arrow,frames,options});return {cancel(){cancelled++;}};} }))};
 const cue=initPaginationCue({pagination,page,reducedMotion:motion,isVisible:()=>visible,setTimer:(fn,delay)=>{timers.set(++id,{fn,delay});return id;},clearTimer:id=>timers.delete(id)});
 return {page,motion,pagination,calls,timers,cue,setVisible(value){visible=value;cue.refresh();},get cancelled(){return cancelled;},fire(){const pending=[...timers.values()];timers.clear();pending.forEach(t=>t.fn());}};
}

test('pagination cues idle Work after readiness and returns to rest between finite passes',()=>{
 const f=cueFixture();f.cue.ready();f.cue.ready();assert.equal(f.timers.size,1);assert.equal([...f.timers.values()][0].delay,1500);
 f.fire();assert.equal(f.calls.length,2);assert.equal(f.pagination.dataset.cue,'playing');assert.ok(f.calls.every(c=>c.options.iterations===1));
 f.fire();assert.equal(f.pagination.dataset.cue,'idle');assert.equal([...f.timers.values()][0].delay,5000);
 for(const expected of [4,6]){f.fire();assert.equal(f.calls.length,expected);f.fire();assert.equal(f.pagination.dataset.cue,'idle');assert.equal([...f.timers.values()][0].delay,5000);}
 f.cue.markUsed();f.fire();assert.equal(f.calls.length,6);assert.equal(f.timers.size,0);f.cue.destroy();
});

test('switching away and back to Work re-arms an unconsumed pagination cue',()=>{
 const f=cueFixture();f.cue.ready();f.setVisible(false);assert.equal(f.timers.size,0);
 f.setVisible(true);assert.equal(f.timers.size,1);f.fire();assert.equal(f.calls.length,2);f.cue.destroy();
});

test('pointer and keyboard input defer rather than permanently discard the cue',()=>{
 for(const [down,up] of [['pointerdown','pointerup'],['keydown','keyup']]){
  const f=cueFixture();f.cue.ready();f.page.dispatchEvent(new Event(down));assert.equal(f.timers.size,0);
  f.page.dispatchEvent(new Event(up));assert.equal(f.timers.size,1);f.fire();assert.equal(f.calls.length,2);f.cue.destroy();
 }
});

test('actually paging stops the cue for the rest of the visit, including after Work is revisited',()=>{
 const f=cueFixture();f.cue.ready();f.fire();f.cue.markUsed();assert.equal(f.cancelled,2);assert.equal(f.timers.size,0);
 f.setVisible(false);f.setVisible(true);f.cue.ready();assert.equal(f.timers.size,0);f.cue.destroy();
});

test('hidden pages, reduced motion and covered terminal views never play cues',()=>{
 for(const options of [{reduced:true},{visible:false}]){const f=cueFixture(options);f.cue.ready();f.fire();assert.equal(f.calls.length,0);f.cue.destroy();}
 const f=cueFixture();f.cue.ready();f.page.hidden=true;f.page.dispatchEvent(new Event('visibilitychange'));f.fire();assert.equal(f.calls.length,0);
 f.page.hidden=false;f.page.dispatchEvent(new Event('visibilitychange'));f.fire();assert.equal(f.calls.length,2);
 f.motion.matches=true;f.motion.dispatchEvent(new Event('change'));assert.equal(f.cancelled,2);assert.equal(f.timers.size,0);f.cue.destroy();
});

test('destroying the cue clears timers and cannot be restarted by input',()=>{
 const f=cueFixture();f.cue.ready();f.cue.destroy();assert.equal(f.timers.size,0);
 f.page.dispatchEvent(new Event('keyup'));f.cue.refresh();f.fire();assert.equal(f.calls.length,0);
});
function fixture(reducedMotion=false,visible=true){
  const display=new Element(),pilot=new Element();
  const keys=['work','about','contact'].map(view=>{const e=new Element();e.dataset.view=view;return e;});
  const screens=keys.map(k=>{const e=new Element();e.dataset.screen=k.dataset.view;return e;});
  const calls=[],timers=new Map();let timer=0;
  const controller=initTerminalControls({display,pilot,keys,screens,reducedMotion,isVisible:()=>visible,onPage:n=>calls.push(n),onOpen:()=>calls.push('open'),onLeaveWork:()=>calls.push('cancel'),setTimer:(fn,delay)=>{timers.set(++timer,{fn,delay});return timer;},clearTimer:n=>timers.delete(n)});
  return {display,pilot,keys,screens,calls,timers,controller};
}
test('Work is the initial screen and non-work screens have no page counter',()=>{
  const f=fixture();assert.deepEqual(f.screens.map(s=>s.hidden),[false,true,true]);
  assert.deepEqual(f.keys.map(k=>k.attrs['aria-pressed']),['true','false','false']);
  f.controller.projectChanged(1,3);assert.equal(f.display.querySelector('#display-number').textContent,'2/3');
  f.controller.show('about');assert.equal(f.display.querySelector('.display-pagination').hidden,true);
  assert.equal(f.display.querySelector('#contact-display-link').hidden,true);
  f.controller.show('contact');assert.equal(f.display.querySelector('#contact-display-link').hidden,false);
  f.controller.show('work');assert.equal(f.display.querySelector('.display-pagination').hidden,false);
});
test('arrows and deliberate horizontal swipes page, while vertical or small gestures keep the current page',()=>{
  const f=fixture();f.display.querySelector('[data-page="next"]').fire('click');f.display.querySelector('[data-page="previous"]').fire('click');
  const swipe=(x,y)=>{f.display.fire('pointerdown',{button:0,pointerId:1,clientX:200,clientY:100,target:new Element()});f.display.fire('pointerup',{pointerId:1,clientX:200+x,clientY:100+y});};
  swipe(-60,3);swipe(60,4);swipe(5,65);swipe(8,0);
  assert.deepEqual(f.calls,[1,-1,1,-1]);
  let stopped=false;f.display.handlers.get('click:capture')({preventDefault(){stopped=true;},stopImmediatePropagation(){}});assert.equal(stopped,true);
});
test('the LED starts off, holds amber for300ms, and a repeated press resets the hold',()=>{
  const f=fixture();assert.equal(f.pilot.classes.has('is-lit'),false);
  f.controller.pulse();assert.equal(f.pilot.classes.has('is-lit'),true);assert.equal([...f.timers.values()][0].delay,300);
  f.controller.pulse();assert.equal(f.timers.size,1);
  [...f.timers.values()][0].fn();assert.equal(f.pilot.classes.has('is-lit'),false);
});

test('live reduced-motion changes stop subsequent terminal animations',()=>{
  const media={matches:false};const f=fixture(media);
  f.controller.projectChanged(1,3);assert.equal(f.screens[0].animations,1);
  media.matches=true;f.controller.projectChanged(2,3);assert.equal(f.screens[0].animations,1);
  f.controller.show('about');assert.equal(f.screens[1].animations,undefined);
});

test('gallery selection can update the counter without animating the covered terminal',()=>{
  const f=fixture(false,false);f.controller.projectChanged(2,3);
  assert.equal(f.display.querySelector('#display-number').textContent,'3/3');
  assert.equal(f.screens[0].animations,undefined);
});

test('the hidden command screen cannot page projects or open one from blank-screen taps',()=>{
  const f=fixture();f.display.dataset.shell='true';
  f.display.fire('keydown',{key:'ArrowRight',preventDefault(){}});
  f.display.fire('pointerdown',{button:0,pointerId:1,clientX:200,clientY:100});
  f.display.fire('pointerup',{pointerId:1,clientX:100,clientY:100});
  f.display.fire('click',{target:new Element()});assert.deepEqual(f.calls,[]);
  delete f.display.dataset.shell;f.display.fire('click',{target:new Element()});assert.deepEqual(f.calls,['open']);
});
