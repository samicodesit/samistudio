import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initTerminalControls } from '../assets/terminal-controls.mjs';

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
