import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {KeySpring} from '../assets/key-spring.mjs';

const source=await readFile(new URL('../assets/studio.js',import.meta.url),'utf8');
const mechanism=source.slice(source.indexOf('  mechanisms = keys.map('),source.indexOf('\n  reducedMotion.addEventListener'));

function fixture(reduced=false){
  let time=0,id=0;
  const tasks=new Map(),sounds=[],selections=[],frames=new Map();
  const key={dataset:{view:'about'},style:{setProperty(){}},classList:{add(){},remove(){}},
    listeners:{},getAttribute:()=> 'false',querySelector:()=>({style:{}}),setPointerCapture(){},
    addEventListener(type,fn){this.listeners[type]=fn;},focus(){}};
  const context={KeySpring,keys:[key],mechanisms:[],reducedMotion:{matches:reduced},
    performance:{now:()=>time},terminalControls:{pulse(){}},
    playKeySound:prepare=>sounds.push({prepare:!!prepare,time}),
    showView:view=>selections.push(view),
    requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:n=>frames.delete(n),
    clearTimeout:n=>tasks.delete(n),window:{setTimeout:(fn,delay)=>{tasks.set(++id,{fn,at:time+delay});return id;}}};
  vm.runInNewContext(mechanism,context);
  const fire=(type,extra={})=>key.listeners[type]?.({button:0,pointerId:1,detail:1,preventDefault(){},...extra});
  const advance=ms=>{const end=time+ms;while(time<end){time=Math.min(time+1000/120,end);
    for(const [n,task] of [...tasks])if(task.at<=time){tasks.delete(n);task.fn();}
    const batch=[...frames];frames.clear();for(const [,fn]of batch)fn(time);
  }};
  return {fire,advance,sounds,selections,key,frames,tasks};
}

test('pointer and keyboard play one click on the downstroke, with no second click on release',()=>{
  for(const input of ['pointer','keyboard']){
    const f=fixture();
    f.fire(input==='pointer'?'pointerdown':'keydown',{key:' '});
    assert.equal(f.sounds.filter(x=>!x.prepare).length,1,'sound starts on initial pressure');
    f.advance(80);
    f.fire(input==='pointer'?'pointerup':'keyup',{key:' '});
    if(input==='pointer')f.fire('click');
    f.advance(500);
    assert.equal(f.sounds.filter(x=>!x.prepare).length,1,'release cannot double the click');
    assert.equal(f.selections.length,1,'one gesture must not activate the screen twice');
    assert.equal(f.frames.size,0,'no spring frames remain while idle');
  }
});

test('quick taps complete a visible stroke and cancelled touches cannot remain pressed',()=>{
  const f=fixture();f.fire('pointerdown');f.advance(8);f.fire('pointerup');f.fire('click');
  f.advance(60);
  assert.ok(+f.key.dataset.stroke>1.3,'a quick tap still reaches the physical seat');
  f.advance(500);assert.equal(f.frames.size,0);
  f.fire('pointerdown');f.advance(8);f.fire('pointercancel');f.advance(500);
  assert.equal(f.frames.size,0);assert.equal(f.tasks.size,0);
  assert.equal(+f.key.dataset.stroke,0);
});

test('reduced motion and keyboard repeat keep activation immediate without an animation loop',()=>{
  const f=fixture(true);f.fire('keydown',{key:'Enter'});
  assert.deepEqual(f.selections,['about']);
  f.fire('keydown',{key:'Enter',repeat:true});
  assert.equal(f.sounds.filter(x=>!x.prepare).length,1);
  f.fire('keyup',{key:'Enter'});f.advance(100);
  assert.equal(f.frames.size,0);
});

test('assistive clicks are never dropped by a debounce window',()=>{
  const f=fixture();
  for(let i=0;i<4;i++){f.fire('click',{detail:0});f.advance(100);}
  assert.equal(f.selections.length,4);
  assert.equal(f.sounds.filter(x=>!x.prepare).length,4);
  f.advance(500);assert.equal(f.frames.size,0);
});

test('the mechanical click is cached, bounded, click-free at its ends and queued on the first gesture',()=>{
  const buffers=[],starts=[],sources=[];
  let resumes=0;
  class AudioContext {
    sampleRate=48000; currentTime=0; state='suspended'; destination={};
    createBuffer(channels,length){const data=new Float32Array(length);buffers.push(data);return {getChannelData:()=>data};}
    createBufferSource(){const source={connect(){},disconnect(){},start:time=>starts.push(time),stop(){this.onended?.();}};sources.push(source);return source;}
    resume(){resumes++;this.state='running';return Promise.resolve();}
  }
  const audioCode=source.slice(source.indexOf('  let audioContext;'),source.indexOf('  mechanisms = keys.map('));
  const context={window:{AudioContext},document:{hidden:false}};
  vm.runInNewContext(audioCode+'\nthis.play=playKeySound;',context);
  for(let i=0;i<8;i++)context.play();
  assert.equal(resumes,1);
  assert.equal(buffers.length,1,'synthesis is cached across repeated taps');
  assert.equal(starts.length,8,'the first suspended-context gesture is not lost');
  assert.ok(starts.every(time=>time>=0&&time<=.025),'the sound stays aligned to the downstroke');
  const samples=buffers[0];
  assert.equal(samples[0],0);assert.equal(samples.at(-1),0);
  assert.ok(samples.every(Number.isFinite));
  assert.ok(Math.max(...samples.map(Math.abs))<.3,'quiet transient leaves ample headroom');
  const rms=Math.sqrt(samples.reduce((sum,x)=>sum+x*x,0)/samples.length);
  assert.ok(rms>.015&&rms<.08,'the short click has substance without a loud tail');
  context.document.hidden=true;context.play();assert.equal(starts.length,8);
});

test('audio can be prepared during loading without playing or resuming before a gesture',()=>{
  let contexts=0,resumes=0,starts=0,buffers=0;
  class AudioContext {
    sampleRate=48000;currentTime=0;state='suspended';destination={};
    constructor(){contexts++;}
    createBuffer(channels,length){buffers++;return {getChannelData:()=>new Float32Array(length)};}
    createBufferSource(){return {connect(){},start(){starts++;}};}
    resume(){resumes++;this.state='running';return Promise.resolve();}
  }
  const audioCode=source.slice(source.indexOf('  let audioContext;'),source.indexOf('  mechanisms = keys.map('));
  const context={window:{AudioContext},document:{hidden:false}};
  vm.runInNewContext(audioCode+'\nthis.prepare=prepareKeySound;this.play=playKeySound;',context);
  context.prepare();context.prepare();
  assert.equal(contexts,1);assert.equal(buffers,1);assert.equal(resumes,0);assert.equal(starts,0);
  context.play();assert.equal(contexts,1);assert.equal(buffers,1);assert.equal(resumes,1);assert.equal(starts,1);
});
