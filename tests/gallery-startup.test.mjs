import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { getProject } from '../assets/project-data.mjs';
import { projectAssets, allowPrefetch } from '../assets/gallery-loading.mjs';
import { gallerySequence, centerSlot, settledSlot } from '../assets/gallery-navigation.mjs';
import * as geometry from '../assets/gallery-geometry.mjs';

// Run the real controller with animations deliberately held unfinished. This
// models the opening period independently of animation or device frame rate.
async function galleryFixture({viewportHeight=711, trackHeight=viewportHeight, extraTail=0,reduced=false,slowProject=null,failedProject=null,autoOpen=true}={}) {
  const requests = [], animations = [], frames = [], scrollWrites = [], scrollOptions = [], measurements = [], timers = new Map();
  let timerId = 0;
  const decodeGates=[]; let selectedLayout='tablet';
  class Element {
    constructor() {
      this.dataset = {}; this.children = []; this.nodes = new Map(); this.attrs = new Map();
      this.listeners = new Map(); this.style = {values:new Map(),setProperty(key,value){this.values.set(key,value);},getPropertyValue(key){return this.values.get(key);}}; this.classList = {add() {},remove() {}};
      this.scrollTop = 0; this.open = false;
    }
    querySelector(key) { if (!this.nodes.has(key)) this.nodes.set(key,new Element()); this.nodes.get(key).parentElement=this; this.nodes.get(key).debugKey=key; return this.nodes.get(key); }
    querySelectorAll() { return []; }
    addEventListener(key,fn) { const list=this.listeners.get(key)||[]; list.push(fn); this.listeners.set(key,list); }
    emit(key,event={}) { for (const fn of this.listeners.get(key)||[]) fn(event); }
    append(child) { this.children=this.children.filter(node=>node!==child); this.children.push(child); child.parentElement=this; }
    get offsetTop() { return this.parentElement?.children.indexOf(this)*this.parentElement.clientHeight || 0; }
    setAttribute(key,value) { this.attrs.set(key,value); }
    removeAttribute(key) { this.attrs.delete(key); }
    getAttribute(key) { return this.attrs.get(key) ?? null; }
    getBoundingClientRect() { measurements.push(this.debugKey); return {width:393,height:this.debugKey==='.gallery-chrome'?0:this.debugKey==='.gallery-header'?60:72}; }
    contains() { return false; }
    focus() {}
    replaceChildren() {}
    decode() { return Promise.resolve(); }
    scrollTo(options) { scrollOptions.push(options); scrollWrites.push(options.top); this.scrollTop=options.top; }
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
  const rows = ['doodle','autolister','cryptik'].map(id=>{const row=new Element();row.dataset.project=id;row.querySelector('.work-summary').textContent=`Description for ${id}.`;return row;});
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
    URL,console, getProject,projectAssets,allowPrefetch,gallerySequence,centerSlot,settledSlot,...geometry,
    matchMedia:query=>({matches:query.includes('prefers-reduced-motion') ? reduced : query.includes('orientation: portrait') ? selectedLayout==='tablet' : query.includes('orientation: landscape') ? selectedLayout==='landscape' : query.includes('min-aspect-ratio: 2/1') ? selectedLayout==='panorama' : query.includes('min-aspect-ratio') && selectedLayout==='wide',addEventListener(){}}),
    getComputedStyle:()=>({getPropertyValue:()=>''}),
    requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},
    setTimeout:(fn,delay)=>{timers.set(++timerId,{fn,delay});return timerId;},clearTimeout:id=>timers.delete(id),
    ResizeObserver:class {observe() {}},
    Image:class {set src(value){this.path=value;requests.push(value);} decode(){if(failedProject&&this.path.includes(failedProject))return Promise.reject(new Error('Offline'));return slowProject && this.path.includes(slowProject) ? new Promise(resolve=>decodeGates.push(resolve)) : Promise.resolve();}},
    history:{state:null,entries:[],pushState(state,_,hash){this.state=state;this.entries.push({state,hash});},replaceState(state,_,hash){this.state=state;this.entries[this.entries.length-1]={state,hash};},back(){this.state=null;context.location.hash="";window.emit("popstate");}},location:{hash:'',pathname:'/',search:''}};
  const source=(await readFile(new URL('../assets/project-gallery.js',import.meta.url),'utf8'))
    .replace(/^import .*;\r?\n/gm,'').replace('export function initProjectGallery','function initProjectGallery')
    .replace('import.meta.url',"'https://studio.test/assets/project-gallery.js'");
  runInNewContext(`${source}\ncontroller=initProjectGallery({onReturn(){}});`,context);
  const flush=async()=>{for(let i=0;i<80;i++)await Promise.resolve();};
  if(autoOpen) rows[0].emit('click'); await flush();
  return {dialog:document.querySelector('#project-gallery'),track:document.querySelector('#project-gallery').querySelector('.gallery-track'),
    requests,animations,frames,timers,flush,window,scrollWrites,scrollOptions,measurements,rows,controller:context.controller,history:context.history,
    releaseDecodes(){decodeGates.splice(0).forEach(resolve=>resolve());},
    blockProject(id){slowProject=id;},
    setLayout(value){selectedLayout=value;context.innerWidth=value==='landscape'?844:393;window.emit('resize');},
    setViewport(width,height){context.innerWidth=width;context.innerHeight=height;track.clientHeight=height;window.emit('resize');},
    flushFrames(){let count=0;while(frames.length && count++<10)frames.splice(0).forEach(fn=>fn());},
    takeSettlement(){const entry=[...timers.entries()].find(([,timer])=>timer.delay===180); assert.ok(entry,'settlement is queued after native input');timers.delete(entry[0]);return entry[1].fn;},
    async runSettlement(){await this.takeSettlement()();await flush();}};
}

const H=711;

test('first visible scene scrolls while entrance animations remain unfinished',async()=>{
  const {dialog,track,animations}=await galleryFixture();
  assert.equal(dialog.open,true); assert.equal(dialog.dataset.phase,'open');
  assert.equal(track.scrollTop,3*H); assert.equal(track.children.length,9);
  assert.ok(animations.length>0);
});

test('wheel and touch interrupt decorative motion without consuming native input',async()=>{
  for(const event of ['wheel','touchstart']) {
    const {track,animations}=await galleryFixture(); let prevented=false;
    track.emit(event,{preventDefault(){prevented=true;}});
    assert.ok(animations.every(animation=>animation.cancelled));
    assert.equal(prevented,false);
  }
});

test('opening prepares all projects for the current layout only',async()=>{
  const {requests,track}=await galleryFixture();
  assert.equal(new Set(requests).size,3);
  assert.ok(requests.every(path=>path.includes('portrait-room')));
  assert.ok(track.children.every(panel=>panel.dataset.ready==='true'));
});

test('ordinary scroll keeps snap targets and native position untouched',async()=>{
  const f=await galleryFixture(); f.flushFrames();
  const original=[...f.track.children]; f.scrollWrites.length=0;
  for(const [slot,id] of [[4,'autolister'],[5,'cryptik'],[4,'autolister'],[3,'doodle']]) {
    f.track.scrollTop=slot*H; f.track.emit('scroll'); f.flushFrames(); f.track.emit('scrollend');
    await f.runSettlement();
    assert.equal(f.dialog.dataset.project,id);
    assert.equal(f.scrollWrites.length,0);
    assert.ok(f.track.children.every((node,index)=>node===original[index]));
  }
});

test('repeated wraps preserve order and relocate only an identical idle copy',async()=>{
  const f=await galleryFixture(); f.flushFrames();
  const original=[...f.track.children];
  for(const direction of [1,1,1,1,1,1,-1,-1,-1,-1,-1,-1]) {
    const from=f.track.scrollTop/H, slot=from+direction;
    const expected=f.track.children[slot].dataset.project;
    f.track.emit('touchstart'); f.track.scrollTop=slot*H; f.track.emit('scroll'); f.flushFrames();
    const held=f.track.scrollTop;
    f.window.emit('touchend',{touches:[]}); await f.runSettlement(); f.flushFrames();
    assert.equal(f.dialog.dataset.project,expected);
    assert.equal(f.track.children[f.track.scrollTop/H].dataset.project,expected);
    assert.ok(f.track.children.every((node,index)=>node===original[index]));
    if(slot>=3&&slot<6) assert.equal(f.track.scrollTop,held);
    else assert.equal(f.track.scrollTop,centerSlot(slot,3)*H);
  }
});

test('a finger down or partial native movement cannot trigger relocation',async()=>{
  const f=await galleryFixture(); f.flushFrames(); f.scrollWrites.length=0;
  f.track.emit('touchstart'); f.track.scrollTop=6*H; f.track.emit('scrollend');
  await f.runSettlement(); assert.equal(f.scrollWrites.length,0);
  f.track.scrollTop=5.4*H; f.window.emit('touchend',{touches:[]}); await f.runSettlement();
  assert.equal(f.scrollWrites.length,0);
});

test('viewport resize during touch or wheel never writes scroll corrections',async()=>{
  for(const event of ['touchstart','wheel']) {
    const f=await galleryFixture(); f.flushFrames(); f.scrollWrites.length=0;
    f.track.emit(event); f.track.scrollTop=3.4*H; f.track.emit('scroll'); f.flushFrames();
    f.track.clientHeight=780; f.window.visualViewport.height=780; f.window.emit('resize'); f.flushFrames();
    assert.equal(f.scrollWrites.length,0);
    assert.equal(f.track.scrollTop,3.4*H);
    // Model the browser completing its native re-snap after layout.
    f.track.scrollTop=4*H; f.window.emit('touchend',{touches:[]}); f.track.emit('scrollend');
    await f.runSettlement(); assert.equal(f.dialog.dataset.project,'autolister');
    assert.ok(f.scrollWrites.length<=1,'only the final idle fit may align the same project');
  }
});

test('terminal loading waits for every scene before showing the gallery',async()=>{
  const f=await galleryFixture({slowProject:'autolister'});
  assert.equal(f.dialog.open,false);assert.equal(f.rows[0].attrs.get('aria-busy'),'true');
  f.releaseDecodes();await f.flush();
  assert.equal(f.dialog.open,true);
  assert.ok(f.track.children.every(panel=>panel.dataset.ready==='true'));
});

test('cancelling terminal loading prevents a stale open after late decoding',async()=>{
  const f=await galleryFixture({slowProject:'autolister'});
  f.controller.cancelPending();f.releaseDecodes();await f.flush();
  assert.equal(f.dialog.open,false);
  f.rows[2].emit('click');await f.flush();
  assert.equal(f.dialog.dataset.project,'cryptik');
});

test('boundary overscroll recovers without scrollend, including a stale extra extent',async()=>{
  for(const [slot,id] of [[-1,'doodle'],[9,'cryptik']]) {
    const f=await galleryFixture({extraTail:188});f.flushFrames();
    f.track.emit('touchstart');f.track.scrollTop=slot*H;f.track.emit('scroll');f.flushFrames();
    f.window.emit('touchend',{touches:[]});await f.runSettlement();
    assert.equal(f.dialog.dataset.project,id);
    assert.equal(f.track.scrollTop,id==='doodle'?3*H:5*H);
  }
});

test('keyboard moves one physical page and reduced motion uses no animation',async()=>{
  const f=await galleryFixture({reduced:true});f.flushFrames();
  f.track.emit('keydown',{key:'ArrowDown',target:{closest(){return null;}},preventDefault(){}});
  assert.equal(f.track.scrollTop,4*H);assert.equal(f.animations.length,0);
  f.track.emit('scrollend');await f.runSettlement();assert.equal(f.dialog.dataset.project,'autolister');
});

test('one history entry survives a full loop and Back returns to the terminal',async()=>{
  const f=await galleryFixture({reduced:true});f.flushFrames();
  for(const slot of [4,5,6]) {f.track.scrollTop=slot*H;f.track.emit('scrollend');await f.runSettlement();}
  assert.equal(f.history.entries.length,1);
  f.dialog.emit('cancel',{preventDefault(){}});await f.flush();
  assert.equal(f.dialog.open,false);
  f.rows[2].emit('click');await f.flush();f.flushFrames();
  assert.equal(f.dialog.dataset.project,'cryptik');assert.equal(f.track.scrollTop,5*H);
});

test('closing cancels queued wrap work and reopening preserves readiness',async()=>{
  const f=await galleryFixture({reduced:true});f.flushFrames();
  f.track.scrollTop=6*H;f.track.emit('scrollend');
  f.dialog.emit('cancel',{preventDefault(){}});await f.flush();
  const writes=f.scrollWrites.length;
  assert.equal(f.dialog.open,false);assert.equal(f.scrollWrites.length,writes);
  f.rows[1].emit('click');await f.flush();
  assert.equal(f.dialog.dataset.project,'autolister');
  assert.ok(f.track.children.every(panel=>panel.dataset.ready==='true'));
});

test('every scene copy is decoded before the gallery becomes visible',async()=>{
  const f=await galleryFixture();
  assert.equal(f.track.children.filter(node=>node.dataset.ready==='true').length,9);
});

test('terminal-ready starts warming all three current-layout scenes before a click',async()=>{
  const f=await galleryFixture({autoOpen:false});
  f.controller.ready();await f.flush();
  for(const id of ['doodle','autolister','cryptik']) assert.ok(f.requests.some(url=>url.includes(id)),id);
  assert.equal(f.dialog.open,false);
});


test('an orientation change during loading prepares the new layout before opening',async()=>{
  const f=await galleryFixture({slowProject:'autolister'});
  f.setLayout('landscape');f.releaseDecodes();await f.flush();
  assert.equal(f.dialog.open,false);
  f.releaseDecodes();await f.flush();
  assert.equal(f.dialog.open,true);
  assert.ok(f.track.children.every(panel=>panel.querySelector('.composed-photo img').src.includes('landscape')));
});

test('orientation refresh retains existing images until all new artwork is prepared',async()=>{
  const f=await galleryFixture();f.flushFrames();f.scrollWrites.length=0;
  f.blockProject('autolister');f.setLayout('landscape');f.flushFrames();await f.runSettlement();await f.flush();
  assert.ok(f.track.children.every(panel=>panel.dataset.ready==='true'));
  assert.ok(f.track.children.every(panel=>panel.querySelector('.composed-photo img').src.includes('portrait-room')));
  f.releaseDecodes();await f.flush();
  assert.ok(f.track.children.every(panel=>panel.querySelector('.composed-photo img').src.includes('landscape')));
  assert.equal(f.scrollWrites.length,0);
});


test('crossing to widescreen retains the previous render until the wide set is decoded',async()=>{
  const f=await galleryFixture();f.flushFrames();
  f.blockProject('autolister');f.setLayout('wide');f.flushFrames();await f.runSettlement();await f.flush();
  assert.ok(f.track.children.every(panel=>panel.dataset.art==='photo'));
  assert.ok(f.track.children.every(panel=>panel.dataset.ready==='true'));
  f.releaseDecodes();await f.flush();
  assert.ok(f.track.children.every(panel=>panel.dataset.art==='wide'));
});


test('browser-bar height changes cannot resize pages underneath an active gesture',async()=>{
  const f=await galleryFixture();f.flushFrames();
  f.track.emit('touchstart');f.track.scrollTop=4*H;f.track.emit('scroll');f.flushFrames();
  f.track.clientHeight=780;f.window.visualViewport.height=780;f.window.emit('resize');f.flushFrames();
  assert.equal(f.track.style.getPropertyValue('--gallery-page-height'),`${H}px`);
  f.window.emit('touchend',{touches:[]});await f.runSettlement();f.flushFrames();
  assert.equal(f.track.style.getPropertyValue('--gallery-page-height'),'780px');
  assert.equal(f.dialog.dataset.project,'autolister');
  assert.equal(f.track.scrollTop,4*780);
});


test('opening scroll placement does not cancel the entrance before it can render',async()=>{
  const f=await galleryFixture();
  f.track.emit('scroll');f.flushFrames();
  assert.ok(f.animations.every(animation=>!animation.cancelled));
});


test('layout measures each project caption once instead of repeating work for every copy',async()=>{
  const f=await galleryFixture();
  assert.equal(f.measurements.filter(key=>key==='.gallery-header').length,1);
  assert.equal(f.measurements.filter(key=>key==='.gallery-caption-frame').length,3);
});

test('a zero-height sticky wrapper cannot place the artwork behind its visible header',async()=>{
  const f=await galleryFixture({autoOpen:false});
  f.setViewport(600,700);f.rows[0].emit('click');await f.flush();
  const panel=f.track.children[0],scale=+panel.style.getPropertyValue('--gallery-scale');
  const top=+panel.style.getPropertyValue('--gallery-top').replace('px','');
  assert.ok(top + getProject('doodle').portraitBounds[1]*scale >= 72-.001);
});


test('both visible scenes remain clickable during a scroll transition',async()=>{
  const f=await galleryFixture();f.flushFrames();
  f.track.scrollTop=3.6*H;f.track.emit('scroll');f.flushFrames();
  assert.equal(f.track.children[3].inert,false);
  assert.equal(f.track.children[4].inert,false);
  assert.equal(f.track.children[0].inert,true);
  f.track.children[4].querySelector('.project-link').emit('click');
  assert.equal(f.dialog.dataset.project,'autolister');
  assert.equal(f.history.state.studioProject,'autolister');
});

test('the new photograph dimensions do not move the shared website header',async()=>{
  const f=await galleryFixture({autoOpen:false});
  f.setLayout('desktop');f.rows[0].emit('click');await f.flush();
  assert.equal(f.track.children[0].style.getPropertyValue('--stage-width'),'1672px');
  assert.equal(f.track.children[0].style.getPropertyValue('--stage-height'),'941px');
  assert.equal(f.track.children[1].style.getPropertyValue('--stage-height'),'1045px');
  const before=f.dialog.style.getPropertyValue('--stage-width');
  f.track.scrollTop=4*H;f.track.emit('scroll');await f.runSettlement();
  assert.equal(f.dialog.style.getPropertyValue('--stage-width'),before);
  assert.equal(before,'1505px');
});

test('ultrawide prepares its extended room while ordinary laptops retain the approved photograph',async()=>{
  for(const mode of ['wide','panorama']) {
    const f=await galleryFixture({autoOpen:false});
    f.setLayout(mode);f.rows[0].emit('click');await f.flush();
    assert.equal(f.dialog.open,true);
    assert.ok(f.track.children.every(panel=>panel.dataset.ready==='true'));
    const expected=mode==='panorama'?'doodle-atelier-panorama.webp':'doodle-atelier-desktop.webp';
    assert.ok(f.requests.some(path=>path.endsWith(expected)));
    assert.ok(!f.requests.some(path=>path.includes(mode==='panorama'?'doodle-atelier-desktop.webp':'doodle-atelier-panorama.webp')));
  }
});


test('terminal paging exposes one project and wraps without opening a gallery',async()=>{
  const f=await galleryFixture({autoOpen:false});
  assert.equal(typeof f.controller.page,'function');
  assert.deepEqual(f.rows.map(row=>row.hidden),[false,true,true]);
  f.controller.page(1);
  assert.deepEqual(f.rows.map(row=>row.hidden),[true,false,true]);
  assert.equal(f.dialog.open,false);
  f.controller.page(-2);
  assert.deepEqual(f.rows.map(row=>row.hidden),[true,true,false]);
  f.rows[2].emit('click');await f.flush();
  assert.equal(f.dialog.dataset.project,'cryptik');
});


test('paging while a project is loading cancels the stale open',async()=>{
  const f=await galleryFixture({autoOpen:false,slowProject:'cryptik'});
  f.rows[0].emit('click');await f.flush();
  f.controller.page(1);f.releaseDecodes();await f.flush();
  assert.equal(f.dialog.open,false);
  assert.deepEqual(f.rows.map(row=>row.hidden),[true,false,true]);
  assert.equal(f.rows[0].attrs.has('aria-busy'),false);
});

test('a failed scene load shows retry feedback on the existing description line and paging restores the copy',async()=>{
  const f=await galleryFixture({autoOpen:false,failedProject:'cryptik'});
  f.rows[0].emit('click');await f.flush();
  assert.equal(f.dialog.open,false);
  assert.match(f.rows[0].querySelector('.work-summary').textContent,/try again/i);
  f.controller.page(1);
  assert.equal(f.rows[0].querySelector('.work-summary').textContent,'Description for doodle.');
  assert.equal(f.rows[1].querySelector('.work-summary').textContent,'Description for autolister.');
});


test('each project rail has three logical marks and an accessible next-project label',async()=>{
  const f=await galleryFixture();
  for(const [slot,panel] of f.track.children.entries()){
    const rail=panel.querySelector('.gallery-scroll-cue');
    assert.match(rail.getAttribute('aria-label')||'',/Scroll to (Doodle|AutoLister|Cryptik)/);
    assert.deepEqual(rail.children.map(mark=>mark.dataset.active),[0,1,2].map(index=>String(index===slot%3)));
    assert.equal(rail.tabIndex,slot===3?0:-1);
  }
});

test('the compact rail advances one native page and loops from Cryptik back to Doodle',async()=>{
  const f=await galleryFixture();f.scrollWrites.length=0;
  f.track.children[3].querySelector('.gallery-scroll-cue').emit('click');
  assert.equal(f.track.scrollTop,4*H);
  assert.equal(f.scrollOptions.at(-1).behavior,'smooth');
  f.track.emit('scrollend');await f.runSettlement();
  f.track.children[4].querySelector('.gallery-scroll-cue').emit('click');
  f.track.emit('scrollend');await f.runSettlement();
  f.track.children[5].querySelector('.gallery-scroll-cue').emit('click');
  assert.equal(f.track.scrollTop,6*H);
  f.track.emit('scrollend');await f.runSettlement();
  assert.equal(f.dialog.dataset.project,'doodle');
  assert.equal(f.track.scrollTop,3*H);
});

test('the final physical copy advances through an identical middle copy without traversing the whole track',async()=>{
  const f=await galleryFixture();const nodes=[...f.track.children];f.scrollWrites.length=0;
  f.track.scrollTop=8*H;
  f.track.children[8].querySelector('.gallery-scroll-cue').emit('click');
  assert.deepEqual(f.scrollWrites,[5*H,6*H]);
  assert.equal(f.scrollOptions.at(-2).behavior,'instant');
  assert.equal(f.scrollOptions.at(-1).behavior,'smooth');
  assert.deepEqual(f.track.children,nodes,'rail never reorders or recreates native snap targets');
});

test('reduced-motion rail navigation moves instantly',async()=>{
  const f=await galleryFixture({reduced:true});
  f.track.children[3].querySelector('.gallery-scroll-cue').emit('click');
  assert.equal(f.track.scrollTop,4*H);assert.equal(f.scrollOptions.at(-1).behavior,'instant');
});
