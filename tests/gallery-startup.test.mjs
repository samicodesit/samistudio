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
async function galleryFixture({viewportHeight=711, trackHeight=viewportHeight, extraTail=0}={}) {
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
    append(child) { this.children=this.children.filter(node=>node!==child); this.children.push(child); child.parentElement=this; }
    get offsetTop() { return this.parentElement?.children.indexOf(this)*this.parentElement.clientHeight || 0; }
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
  const track=document.querySelector('#project-gallery').querySelector('.gallery-track');
  track.clientHeight=trackHeight;
  Object.defineProperty(track,'scrollHeight',{get:()=>track.children.length*track.clientHeight+extraTail});
  const window=new Element(); window.visualViewport={scale:1,height:viewportHeight,addEventListener(){}};
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
    requests,animations,frames,timers,flush,window,
    flushFrames(){let count=0;while(frames.length && count++<10)frames.splice(0).forEach(fn=>fn());},
    async runSettlement(){const timer=[...timers.values()].find(timer=>timer.delay===180); assert.ok(timer); await timer.fn(); await flush();}};
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


for (const [label,offset,project] of [['bottom',1610,'autolister'],['top',-188,'cryptik']]) {
  test(`Safari ${label} overscroll recovers the infinite ring without a scrollend event`,async()=>{
    const fixture=await galleryFixture();
    const {track,dialog,window,flushFrames,runSettlement}=fixture;
    flushFrames();
    track.emit('touchstart');
    track.scrollTop=offset;
    track.emit('scroll'); flushFrames();
    assert.equal(dialog.dataset.project,'doodle','never reorder under an active finger');
    window.emit('touchend',{touches:[]});
    await runSettlement(); flushFrames();
    assert.equal(dialog.dataset.project,project);
    assert.equal(track.scrollTop,711,'restore a full scene with a neighbor in both directions');
  });
}

test('loop uses the rendered track height when the viewport measurement differs',async()=>{
  const {track,dialog,flushFrames}=await galleryFixture({viewportHeight:711,trackHeight:700});
  flushFrames();
  assert.equal(track.scrollTop,700);
  track.scrollTop=1400; track.emit('scrollend'); flushFrames();
  assert.equal(dialog.dataset.project,'autolister');
  assert.equal(track.scrollTop,700);
});

test('multiple full touch cycles never leave an endpoint in either direction',async()=>{
  const {track,dialog,window,flushFrames,runSettlement}=await galleryFixture();
  flushFrames();
  for(const [offset,expected] of [[1422,'autolister'],[1422,'cryptik'],[1422,'doodle'],[1422,'autolister'],[0,'doodle'],[0,'cryptik'],[0,'autolister'],[0,'doodle']]) {
    track.emit('touchstart'); track.scrollTop=offset; track.emit('scroll'); flushFrames();
    window.emit('touchend',{touches:[]}); await runSettlement(); flushFrames();
    assert.equal(dialog.dataset.project,expected);
    assert.equal(track.scrollTop,711);
    assert.equal(track.children.length,3);
  }
});


test('browser-bar resizing never carries a bounced offset beyond the new track',async()=>{
  const {track,dialog,window,flushFrames,runSettlement}=await galleryFixture();
  flushFrames();
  track.emit('touchstart'); track.scrollTop=1610; track.emit('scroll'); flushFrames();
  track.clientHeight=780; window.visualViewport.height=780;
  window.emit('resize'); flushFrames();
  assert.ok(track.scrollTop<=1560,'resize must clamp overscroll before preserving progress');
  window.emit('touchend',{touches:[]}); await runSettlement(); flushFrames();
  assert.equal(dialog.dataset.project,'autolister');
  assert.equal(track.scrollTop,780);
});


test('a stale native scroll extent cannot become an extra blank project',async()=>{
  const {track,dialog,window,flushFrames,runSettlement}=await galleryFixture({extraTail:188});
  flushFrames();
  track.emit('touchstart'); track.scrollTop=1610; track.emit('scroll'); flushFrames();
  window.emit('touchend',{touches:[]}); await runSettlement(); flushFrames();
  assert.equal(dialog.dataset.project,'autolister');
  assert.equal(track.scrollTop,711);
});
