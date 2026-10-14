import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { getProject } from '../assets/project-data.mjs';
import { projectAssets, allowPrefetch } from '../assets/gallery-loading.mjs';
import { galleryOrder, settledSlot } from '../assets/gallery-navigation.mjs';
import * as geometry from '../assets/gallery-geometry.mjs';

// Run the real controller with animations deliberately held unfinished. This
// models the opening period independently of animation or device frame rate.
async function galleryFixture() {
  const requests = [], animations = [], frames = [], timers = new Map();
  let timerId = 0;
  class Element {
    constructor() {
      this.dataset = {}; this.children = []; this.nodes = new Map(); this.attrs = new Map();
      this.listeners = new Map(); this.style = {setProperty() {}}; this.classList = {add() {},remove() {}};
      this.scrollTop = 0; this.open = false;
    }
    querySelector(key) { if (!this.nodes.has(key)) this.nodes.set(key,new Element()); return this.nodes.get(key); }
    querySelectorAll() { return []; }
    addEventListener(key,fn) { const list=this.listeners.get(key)||[]; list.push(fn); this.listeners.set(key,list); }
    emit(key,event={}) { for (const fn of this.listeners.get(key)||[]) fn(event); }
    append(child) { this.children=this.children.filter(node=>node!==child); this.children.push(child); }
    setAttribute(key,value) { this.attrs.set(key,value); }
    removeAttribute(key) { this.attrs.delete(key); }
    getBoundingClientRect() { return {width:393,height:72}; }
    contains() { return false; }
    focus() {}
    replaceChildren() {}
    decode() { return Promise.resolve(); }
    scrollTo({top}) { this.scrollTop=top; }
    showModal() { this.open=true; }
    close() { this.open=false; }
    cloneNode() { return new Element(); }
    animate() {
      let reject;
      const animation={finished:new Promise((_,fail)=>{reject=fail;}),cancelled:false,
        cancel() { this.cancelled=true; reject(new Error('cancelled')); }};
      animations.push(animation); return animation;
    }
  }
  const document = new Element();
  const rows = ['doodle','autolister','cryptik'].map(id=>{const row=new Element();row.dataset.project=id;return row;});
  document.querySelectorAll=()=>rows;
  document.createElement=()=>new Element();
  document.fonts={ready:Promise.resolve()};
  document.documentElement=new Element();
  document.querySelector('#gallery-page-template').content={firstElementChild:new Element()};
  const window=new Element(); window.visualViewport={scale:1,height:711,addEventListener(){}};
  const context={document,window,navigator:{connection:{effectiveType:'4g'}},innerWidth:393,innerHeight:711,
    URL,console, getProject,projectAssets,allowPrefetch,galleryOrder,settledSlot,...geometry,
    matchMedia:query=>({matches:query.includes('orientation: portrait'),addEventListener(){}}),
    getComputedStyle:()=>({getPropertyValue:()=>''}),
    requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},
    setTimeout:(fn,delay)=>{timers.set(++timerId,{fn,delay});return timerId;},clearTimeout:id=>timers.delete(id),
    ResizeObserver:class {observe() {}},
    Image:class {set src(value){requests.push(value);} decode(){return Promise.resolve();}},
    history:{state:null,pushState(){},replaceState(){}},location:{hash:'',pathname:'/',search:''}};
  const source=(await readFile(new URL('../assets/project-gallery.js',import.meta.url),'utf8'))
    .replace(/^import .*;\r?\n/gm,'').replace('export function initProjectGallery','function initProjectGallery')
    .replace('import.meta.url',"'https://studio.test/assets/project-gallery.js'");
  runInNewContext(`${source}\ninitProjectGallery({onReturn(){}});`,context);
  const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
  rows[0].emit('click'); await flush();
  return {dialog:document.querySelector('#project-gallery'),track:document.querySelector('#project-gallery').querySelector('.gallery-track'),
    requests,animations,frames,timers,flush};
}

test('first visible scene accepts scrolling while entrance animations are unfinished', async()=>{
  const {dialog,animations}=await galleryFixture();
  assert.equal(dialog.open,true);
  assert.ok(animations.length>0,'exercise a real animated entrance');
  assert.equal(dialog.dataset.phase,'open','animation completion must not gate scrolling');
});

test('touch and wheel interrupt the decorative entrance without swallowing input',async()=>{
  for(const type of ['touchstart','wheel']) {
    const {track,animations,flush}=await galleryFixture();
    let prevented=false;
    track.emit(type,{preventDefault(){prevented=true;}}); await flush();
    assert.ok(animations.every(a=>a.cancelled),`${type} must release the aperture and caption animations`);
    assert.equal(prevented,false);
  }
});

test('first opening does not eagerly decode every neighboring scene',async()=>{
  const {requests}=await galleryFixture();
  assert.ok(requests.length>0);
  assert.ok(requests.every(url=>url.includes('doodle')),requests.join('\n'));
});


test('keyboard navigation works before entrance animations finish',async()=>{
  const {track,animations}=await galleryFixture();
  let prevented=false;
  track.emit('keydown',{key:'ArrowDown',target:{closest(){return null;}},preventDefault(){prevented=true;}});
  assert.equal(track.scrollTop,1422);
  assert.equal(prevented,true);
  assert.ok(animations.every(a=>a.cancelled));
});

test('closing invalidates scheduled neighboring-scene work',async()=>{
  const {dialog,requests,timers,flush}=await galleryFixture();
  const background=[...timers.values()].find(timer=>timer.delay===1400);
  assert.ok(background,'neighbors are queued after the entrance');
  const before=requests.length;
  dialog.emit('cancel',{preventDefault(){}});
  await background.fn(); await flush();
  assert.equal(requests.length,before);
  assert.equal(dialog.dataset.phase,'closing');
});
