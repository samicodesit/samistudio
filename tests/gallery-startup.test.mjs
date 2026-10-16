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
    getBoundingClientRect() { measurements.push(this.debugKey); const height=this.debugKey==='.gallery-chrome'?0:this.debugKey==='.gallery-header'?60:72; return {width:393,height,top:0,bottom:height}; }
    contains() { return false; }
    focus() {}
    replaceChildren() {}
    decode() { return Promise.resolve(); }
    scrollTo(options) { scrollOptions.push(options); scrollWrites.push(options.top); this.scrollTop=options.top; }
    showModal() { this.open=true; }
    close() { this.open=false; }
    cloneNode() { return new Element(); }
    animate(keyframes,options) {
      let reject;
      const animation={target:this,keyframes,options,finished:new Promise((_,fail)=>{reject=fail;}),cancelled:false,
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

test('a new scene gets two diminishing gravity rebounds only after native settlement',async()=>{
  const f=await galleryFixture();f.flushFrames();await f.runSettlement();
  const landings=()=>f.animations.filter(a=>a.target.className==='gallery-landing');
  assert.equal(landings().length,0,'opening cannot bounce');
  f.track.emit('touchstart');f.track.scrollTop=4*H;f.track.emit('scroll');f.flushFrames();
  f.track.emit('scrollend');await f.flush();
  assert.equal(landings().length,0,'the scene cannot bounce under the finger');
  f.window.emit('touchend',{touches:[]});f.track.emit('scrollend');await f.flush();
  assert.equal(landings().length,1);
  const landing=landings()[0],ys=Array.from(landing.keyframes,k=>Number(k.transform.match(/translateY\(([-.\d]+)px\)/)[1]));
  assert.equal(ys[0],0,'arrival cannot jump to an offset');assert.equal(ys.at(-1),0);
  const peaks=ys.filter((y,i)=>i>0&&i<ys.length-1&&y<ys[i-1]&&y<ys[i+1]);
  assert.equal(peaks.length,2);assert.ok(Math.abs(peaks[0])>Math.abs(peaks[1])*3);
  assert.ok(Math.min(...ys)>=-8&&Math.max(...ys)===0,'the scene never crosses its floor');
  assert.equal(landing.options.duration,360);
  const count=landings().length;f.track.emit('scrollend');await f.flush();
  assert.equal(landings().length,count,'duplicate settlement cannot replay the landing');
});

test('arrival begins on the next render frame without waiting for scrollend or the idle timer',async()=>{
  const f=await galleryFixture();f.flushFrames();f.scrollWrites.length=0;
  f.track.scrollTop=4*H-4;f.track.emit('scroll');f.flushFrames();
  assert.equal(f.animations.filter(a=>a.target.className==='gallery-landing').length,0);
  f.track.scrollTop=4*H;f.track.emit('scroll');f.flushFrames();
  assert.equal(f.animations.filter(a=>a.target.className==='gallery-landing').length,1);
  assert.equal(f.dialog.dataset.project,'autolister');
  assert.equal(f.scrollWrites.length,0,'early visual handoff cannot relocate the native track');
});

test('input or renewed movement invalidates an arrival queued for the next paint',async()=>{
  for(const interrupt of ['touch','move','resize']) {
    const f=await galleryFixture();f.flushFrames();
    f.track.scrollTop=4*H;f.track.emit('scroll');
    f.frames.splice(0).forEach(fn=>fn());
    if(interrupt==='touch')f.track.emit('touchstart');
    else if(interrupt==='resize')f.setViewport(390,844);
    else f.track.scrollTop=4*H+24;
    f.flushFrames();
    assert.equal(f.animations.filter(a=>a.target.className==='gallery-landing').length,0,interrupt);
    assert.equal(f.dialog.dataset.project,'doodle',interrupt);
  }
});

test('releasing a finger on an already snapped new page starts its landing without an idle wait',async()=>{
  const f=await galleryFixture();f.flushFrames();
  f.track.emit('touchstart');f.track.scrollTop=4*H;f.track.emit('scroll');f.flushFrames();
  assert.equal(f.animations.filter(a=>a.target.className==='gallery-landing').length,0);
  f.window.emit('touchend',{touches:[]});f.flushFrames();
  assert.equal(f.animations.filter(a=>a.target.className==='gallery-landing').length,1);
});

test('a loop reset transfers a running landing at its current time instead of replaying it',async()=>{
  const f=await galleryFixture();f.flushFrames();f.scrollWrites.length=0;
  f.track.scrollTop=5*H;f.track.emit('scrollend');await f.flush();
  f.track.emit('wheel');
  f.track.scrollTop=6*H;f.track.emit('scroll');f.flushFrames();
  const before=f.animations.filter(a=>a.target.className==='gallery-landing').at(-1);
  assert.equal(f.track.scrollTop,6*H,'no relocation while native settlement is pending');
  before.currentTime=120;
  f.track.emit('scrollend');await f.flush();
  const after=f.animations.filter(a=>a.target.className==='gallery-landing').at(-1);
  assert.equal(f.track.scrollTop,3*H);
  assert.notEqual(after,before);
  assert.equal(after.currentTime,120,'the identical middle copy keeps the same animation phase');
  assert.equal(before.cancelled,true);
});

test('new input interrupts the landing without moving the native snap targets',async()=>{
  for(const input of ['touchstart','wheel','keydown','resize']){
    const f=await galleryFixture();f.flushFrames();
    f.track.scrollTop=4*H;f.track.emit('scrollend');await f.flush();
    const landing=f.animations.find(a=>a.target.className==='gallery-landing');assert.ok(landing);
    const writes=f.scrollWrites.length;
    if(input==='resize')f.setViewport(390,844);
    else f.track.emit(input,input==='keydown'?{key:'ArrowDown',target:{closest(){return null;}},preventDefault(){}}:{});
    assert.equal(landing.cancelled,true,`${input} must interrupt the landing`);
    if(input!=='keydown')assert.equal(f.scrollWrites.length,writes);
  }
});

test('same-page returns, viewport fitting, and reduced motion do not add landing effects',async()=>{
  for(const reduced of [false,true]){
    const f=await galleryFixture({reduced});f.flushFrames();
    f.track.emit('touchstart');f.track.scrollTop=3.2*H;f.track.emit('scroll');f.flushFrames();
    f.track.scrollTop=3*H;f.window.emit('touchend',{touches:[]});f.track.emit('scrollend');await f.flush();
    assert.equal(f.animations.filter(a=>a.target.className==='gallery-landing').length,0);
    if(reduced){f.track.scrollTop=4*H;f.track.emit('scrollend');await f.flush();assert.equal(f.animations.length,0);}
    else {f.setViewport(390,844);f.flushFrames();f.track.scrollTop=4*H;f.track.emit('scrollend');await f.flush();assert.equal(f.animations.filter(a=>a.target.className==='gallery-landing').length,0);}
  }
});

test('the room edge disappears behind the header before snapping, with no change after settlement',async()=>{
  const f=await galleryFixture();f.flushFrames();f.scrollWrites.length=0;
  const incoming=f.track.children[4];
  const values=[];
  for(const remaining of [200,150,110,80,72,60,20,0]){
    f.track.scrollTop=4*H-remaining;f.track.emit('scroll');f.flushFrames();
    values.push(+incoming.style.getPropertyValue('--room-edge-opacity'));
  }
  assert.equal(values[0],1,'the separator remains fully visible between scenes');
  assert.ok(values[2]>0&&values[2]<1,'it fades naturally as it approaches the header');
  assert.ok(values.slice(4).every(value=>value===0),'the lip disappears before entering the header glass');
  assert.ok(values.every((value,index)=>Number.isFinite(value)&&(!index||value<=values[index-1])));
  assert.equal(values.at(-1),0,'no shadow remains at the top when the page lands');
  const before=incoming.style.getPropertyValue('--room-edge-opacity');
  f.track.emit('scrollend');await f.runSettlement();f.flushFrames();
  assert.equal(incoming.style.getPropertyValue('--room-edge-opacity'),before);
  assert.equal(f.scrollWrites.length,0,'the visual fix cannot move the native scroll position');
});

test('a loop relocation clears the destination edge synchronously before the next paint',async()=>{
  const f=await galleryFixture();f.flushFrames();
  f.track.scrollTop=2*H;f.track.emit('scroll');f.flushFrames();
  assert.equal(+f.track.children[5].style.getPropertyValue('--room-edge-opacity'),1);
  f.track.emit('scrollend');await f.runSettlement();
  assert.equal(f.track.scrollTop,5*H);
  assert.equal(+f.track.children[5].style.getPropertyValue('--room-edge-opacity'),0);
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

test('a named terminal command opens the requested existing project through normal gallery loading',async()=>{
  const f=await galleryFixture({autoOpen:false});
  await f.controller.openProject('autolister');await f.flush();
  assert.equal(f.dialog.open,true);assert.equal(f.dialog.dataset.project,'autolister');
  assert.equal(f.track.scrollTop,4*H);
});
