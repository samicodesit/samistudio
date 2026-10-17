import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fitTerminalEditor,initTerminalViewport} from '../assets/terminal-viewport.mjs';

for(const [width,height,top]of [[320,220,180],[375,310,120],[393,360,240],[430,440,0],[600,240,84],[768,500,0],[844,170,100]])test('typing screen fits visual viewport '+[width,height,top].join('x'),()=>{
 const frame=fitTerminalEditor({width,height,offsetTop:top,offsetLeft:0});
 const left=frame.left+73*frame.scale,screenTop=frame.top+419*frame.scale,right=frame.left+346*frame.scale,bottom=frame.top+589*frame.scale;
 assert(left>=15.9&&right<=width-15.9);assert(screenTop>=top+15.9&&bottom<=top+height-15.9);assert(frame.scale>0);
});
class Surface extends EventTarget {}
function fixture(){
 const page={activeElement:null},input=new Surface(),view=new Surface(),viewport=new Surface(),media=new Surface();
 Object.assign(view,{innerWidth:393,innerHeight:711,visualViewport:viewport});Object.assign(viewport,{width:393,height:711,offsetTop:0,offsetLeft:0,scale:1});media.matches=true;view.matchMedia=()=>media;
 const frames=new Map();let id=0,open=true;const changes=[];
 const controller=initTerminalViewport({input,page,view,isOpen:()=>open,onChange:frame=>changes.push(frame),requestFrame:fn=>{frames.set(++id,fn);return id;},cancelFrame:id=>frames.delete(id)});
 const flush=()=>{const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());};
 const focus=()=>{page.activeElement=input;input.dispatchEvent(new Event('focus'));flush();};
 const metrics=values=>{Object.assign(viewport,values);viewport.dispatchEvent(new Event('resize'));viewport.dispatchEvent(new Event('scroll'));flush();};
 return{page,input,view,viewport,media,controller,changes,frames,focus,flush,metrics,close(){open=false;controller.refresh();flush();}};
}
test('focus frames before the keyboard, then follows viewport height and native pan',()=>{const f=fixture();f.focus();assert(f.controller.frame);f.metrics({height:320,offsetTop:190});const a=f.controller.frame;assert.equal(a.top+419*a.scale,206);f.metrics({offsetTop:260});assert.equal(f.controller.frame.top+419*f.controller.frame.scale,276);});
test('blur holds framing until the keyboard dismisses, then restores the normal scene',()=>{const f=fixture();f.focus();f.metrics({height:320,offsetTop:190});f.page.activeElement=null;f.input.dispatchEvent(new Event('blur'));f.flush();assert(f.controller.frame);f.metrics({height:711,offsetTop:0});assert.equal(f.controller.frame,null);});
test('closing the terminal always restores the normal layout even with stale keyboard offsets',()=>{const f=fixture();f.focus();f.metrics({height:320,offsetTop:190});f.close();assert.equal(f.controller.frame,null);});
test('desktop and pinch zoom retain browser control, without fighting magnification',()=>{const f=fixture();f.media.matches=false;f.focus();assert.equal(f.controller.frame,null);f.media.matches=true;f.controller.refresh();f.flush();const before=f.controller.frame;f.metrics({scale:2,width:196,height:180,offsetTop:300});assert.deepEqual(f.controller.frame,before);});
test('viewport events coalesce into one frame, and disposal removes every pending callback',()=>{const f=fixture();f.focus();f.viewport.dispatchEvent(new Event('resize'));f.viewport.dispatchEvent(new Event('scroll'));assert.equal(f.frames.size,1);f.controller.destroy();assert.equal(f.frames.size,0);f.viewport.dispatchEvent(new Event('resize'));f.input.dispatchEvent(new Event('focus'));assert.equal(f.frames.size,0);});

test('moving focus from the input to submit keeps the camera still until the click completes',()=>{const f=fixture(),submit={};f.input.form={contains:node=>node===submit||node===f.input};f.focus();const before=f.controller.frame;f.page.activeElement=submit;f.input.dispatchEvent(new Event('blur'));f.flush();assert.deepEqual(f.controller.frame,before);f.page.activeElement=null;f.controller.refresh();f.flush();assert.equal(f.controller.frame,null);});

test('hiding the keyboard restores home even if the browser retains input focus',()=>{const f=fixture();f.focus();f.metrics({height:320,offsetTop:180});assert(f.controller.frame);f.metrics({height:711,offsetTop:0});assert.equal(f.page.activeElement,f.input);assert.equal(f.controller.frame,null);f.metrics({height:320,offsetTop:180});assert(f.controller.frame);});
test('closing while pinch zoomed clears editing without resetting the browser zoom',()=>{const f=fixture();f.focus();f.metrics({scale:2,width:196,height:180,offsetTop:300});f.close();assert.equal(f.controller.frame,null);assert.equal(f.viewport.scale,2);});

test('rotating with the keyboard open refits the display and restores after dismissal',()=>{const f=fixture();f.focus();f.metrics({height:320,offsetTop:190});f.view.innerWidth=844;f.view.innerHeight=390;f.metrics({width:844,height:170,offsetTop:84});const a=f.controller.frame;assert(a.top+419*a.scale>=100-.01);assert(a.top+589*a.scale<=254-16+.01);f.page.activeElement=null;f.input.dispatchEvent(new Event('blur'));f.flush();assert(f.controller.frame);f.metrics({height:390,offsetTop:0});assert.equal(f.controller.frame,null);});
