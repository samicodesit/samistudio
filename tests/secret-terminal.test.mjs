import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseTerminalCommand, initSecretTerminal} from '../assets/secret-terminal.mjs';

class Element {
  constructor(page) { this.page=page; this.dataset={}; this.hidden=false; this.value=''; this.children=[]; this.nodes=new Map(); this.listeners=new Map(); this.attrs=new Map(); this.textContent=''; this.tagName='DIV'; }
  querySelector(selector) { if(!this.nodes.has(selector)) this.nodes.set(selector,new Element(this.page)); return this.nodes.get(selector); }
  querySelectorAll(selector) { return selector==='[data-command]' ? this.commands||[] : []; }
  addEventListener(type,fn) { const all=this.listeners.get(type)||[];all.push(fn);this.listeners.set(type,all); }
  removeEventListener(type,fn) { this.listeners.set(type,(this.listeners.get(type)||[]).filter(f=>f!==fn)); }
  emit(type,properties={}) { const event={target:this,button:0,isPrimary:true,pointerId:1,clientX:10,clientY:10,preventDefault(){this.prevented=true;},stopPropagation(){},...properties}; for(const fn of this.listeners.get(type)||[])fn(event);return event; }
  setAttribute(key,value) { this.attrs.set(key,value); }
  removeAttribute(key) { this.attrs.delete(key); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children=[...nodes]; }
  focus() { this.page.activeElement=this; }
  closest(selector) { if(selector==='input,textarea,select,[contenteditable]')return this.tagName==='INPUT'?this:null;return null; }
  animate() { this.animations=(this.animations||0)+1; return {cancel(){}}; }
}
function fixture({reduced=false}={}) {
  const page=new Element();page.page=page;page.defaultView=new Element(page);page.createElement=()=>new Element(page);
  const display=new Element(page);display.dataset.view='work';
  const trigger=display.querySelector('#display-title');trigger.tagName='BUTTON';
  const input=display.querySelector('.shell-input');input.tagName='INPUT';
  const shell=display.querySelector('.screen-shell');shell.hidden=true;
  const actions=display.querySelector('.shell-actions');actions.commands=['ls','whoami','help'].map(command=>{const node=new Element(page);node.dataset.command=command;return node;});
  const calls=[],timers=new Map();let id=0,available=true;
  const controller=initSecretTerminal({display,page,reducedMotion:{matches:reduced},isAvailable:()=>available,
    onEnter:()=>calls.push('enter'),onExit:()=>calls.push('exit'),onOpenProject:id=>calls.push(id),onChange:()=>calls.push('change'),
    setTimer:(fn,delay)=>{timers.set(++id,{fn,delay});return id;},clearTimer:id=>timers.delete(id)});
  const finishHold=()=>{for(const [id,task] of [...timers]){timers.delete(id);task.fn();}};
  return {page,display,trigger,input,shell,actions,calls,timers,controller,finishHold,setAvailable:value=>{available=value;}};
}

test('commands normalize whitespace and case, and open only known portfolio projects',()=>{
  assert.deepEqual(parseTerminalCommand('  OPEN   AutoLister  '),{type:'open',id:'autolister'});
  for(const id of ['doodle','cryptik'])assert.deepEqual(parseTerminalCommand(`open ${id}`),{type:'open',id});
  for(const command of ['ls','whoami','help','exit'])assert.equal(parseTerminalCommand(command).type,command);
  assert.equal(parseTerminalCommand('open').type,'ls');
  for(const bad of ['open https://example.com','open doodle extra','ls; exit','<img onerror=alert(1)>','a'.repeat(81)])assert.equal(parseTerminalCommand(bad).type,'unknown');
  assert.equal(parseTerminalCommand('   ').type,'empty');
});

test('a deliberate Work-label hold opens once, with tappable projects and no input focus',()=>{
  const f=fixture();f.trigger.emit('click',{detail:1});assert.equal(f.controller.isOpen,false);
  f.trigger.emit('pointerdown');assert.equal([...f.timers.values()][0].delay,700);f.finishHold();
  assert.equal(f.controller.isOpen,true);assert.equal(f.display.dataset.shell,'true');assert.equal(f.shell.hidden,false);
  assert.equal(f.calls.filter(c=>c==='enter').length,1);assert.notEqual(f.page.activeElement,f.input);
  const projects=f.display.querySelector('.shell-output').children.flatMap(e=>e.children);
  assert.equal(projects.length,3);projects[1].emit('click');
  assert.ok(f.calls.includes('autolister'));assert.equal(f.controller.isOpen,false);
});

test('movement, cancellation, leaving the label, hiding or blurring cancel a pending hold',()=>{
  for(const cancel of ['move','pointerup','pointercancel','pointerleave','blur','hidden']){
    const f=fixture();f.trigger.emit('pointerdown');
    if(cancel==='move')f.trigger.emit('pointermove',{clientX:22});
    else if(cancel==='blur')f.page.defaultView.emit('blur');
    else if(cancel==='hidden'){f.page.hidden=true;f.page.emit('visibilitychange');}
    else f.trigger.emit(cancel);
    f.finishHold();assert.equal(f.controller.isOpen,false,cancel);assert.equal(f.timers.size,0);
  }
});

test('gallery, non-Work screens, secondary touches and modified or editable shortcuts cannot enter',()=>{
  const f=fixture();f.setAvailable(false);f.controller.open();assert.equal(f.controller.isOpen,false);
  f.setAvailable(true);f.display.dataset.view='contact';f.trigger.emit('pointerdown');f.finishHold();assert.equal(f.controller.isOpen,false);
  f.display.dataset.view='work';f.trigger.emit('pointerdown',{isPrimary:false});f.finishHold();assert.equal(f.controller.isOpen,false);
  f.page.emit('keydown',{key:'`',target:f.input});f.page.emit('keydown',{key:'`',ctrlKey:true});assert.equal(f.controller.isOpen,false);
  f.trigger.emit('pointerdown');f.setAvailable(false);f.finishHold();assert.equal(f.controller.isOpen,false,'availability is rechecked after the hold');
});

test('backtick focuses the desktop prompt and Escape or exit restores Work and trigger focus',()=>{
  for(const exit of ['escape','command']){
    const f=fixture();f.page.emit('keydown',{key:'`'});assert.equal(f.controller.isOpen,true);assert.equal(f.page.activeElement,f.input);
    if(exit==='escape')f.page.emit('keydown',{key:'Escape',target:f.input});else f.controller.run('exit');
    assert.equal(f.controller.isOpen,false);assert.equal(f.page.activeElement,f.trigger);assert.ok(f.calls.includes('exit'));
  }
});

test('command history restores the unfinished draft and remains bounded',()=>{
  const f=fixture();f.controller.open();
  f.controller.run('help');f.controller.run('whoami');f.input.value='open cr';
  f.input.emit('keydown',{key:'ArrowUp'});assert.equal(f.input.value,'whoami');
  f.input.emit('keydown',{key:'ArrowUp'});assert.equal(f.input.value,'help');
  f.input.emit('keydown',{key:'ArrowDown'});f.input.emit('keydown',{key:'ArrowDown'});assert.equal(f.input.value,'open cr');
  for(let i=0;i<30;i++)f.controller.run(`unknown ${i}`);
  for(let i=0;i<30;i++)f.input.emit('keydown',{key:'ArrowUp'});
  assert.equal(f.input.value,'unknown 18');
});

test('physical-view dismissal restores no stale focus, cancels animations, and reduced motion is instant',()=>{
  const f=fixture();f.controller.open();const focused=f.page.activeElement;f.controller.close({restore:false});
  assert.equal(f.page.activeElement,focused);assert.equal(f.calls.includes('exit'),false);assert.equal(f.controller.isOpen,false);
  const reduced=fixture({reduced:true});reduced.controller.open();assert.equal(reduced.shell.animations,undefined);
});

test('tappable commands, safe response text and disposal leave no pending actions',()=>{
  const f=fixture();f.controller.open();f.actions.commands[1].emit('click');
  const output=f.display.querySelector('.shell-output');assert.match(output.children[0].textContent,/Sami/);
  f.controller.run('<img onerror=alert(1)>');assert.equal(output.children.length,1);assert.match(output.children[0].textContent,/help/);
  f.controller.close({restore:false});f.trigger.emit('pointerdown');f.controller.destroy();f.finishHold();
  assert.equal(f.controller.isOpen,false);assert.equal(f.timers.size,0);f.page.emit('keydown',{key:'`'});assert.equal(f.controller.isOpen,false);
});
