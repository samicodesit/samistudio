import {projectiveMatrix} from './assets/gallery-geometry.mjs';
import {clamp,mix,smooth,out,polygon,parseAperture,portalCamera,signalAperture} from './entry-paths.mjs';
import {motionPreference} from './assets/motion-preferences.mjs';
const direction=new URLSearchParams(location.search).get('entry')==='signal'?'signal':'portal';
let active=0, running=[],latestRequest=0;
let finishCurrent=null;
let resolveReady;const prepared=new Promise(resolve=>{resolveReady=resolve;});
const post=data=>parent!==window&&parent.postMessage({type:'study-state',direction,...data},location.origin);
function sampled(fn,count=101){return Array.from({length:count},(_,i)=>({offset:i/(count-1),...fn(i/(count-1))}));}
function drawScene(panel,w,h) {
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext('2d',{alpha:false});
 const image=panel.element.dataset.art==='wide'?panel.environment:panel.photo;
 const box=image.getBoundingClientRect(),fit=getComputedStyle(image).objectFit;
 ctx.fillStyle='#d8c7cd';ctx.fillRect(0,0,w,h);
 if(fit==='cover') {
  const s=Math.max(box.width/image.naturalWidth,box.height/image.naturalHeight);
  const iw=image.naturalWidth*s,ih=image.naturalHeight*s;
  const position=getComputedStyle(image).objectPosition.split(' ').map(parseFloat);
  ctx.drawImage(image,box.left+(box.width-iw)*(Number.isFinite(position[0])?position[0]:50)/100,box.top+(box.height-ih)*(Number.isFinite(position[1])?position[1]:50)/100,iw,ih);
 } else ctx.drawImage(image,box.left,box.top,box.width,box.height);
 return canvas;
}
window.playEntryPreview=({dialog,track,panel,aperture,reducedMotion})=>{
 finishCurrent?.();
 const run=++active,hero=document.querySelector('.experience'),chrome=dialog.querySelector('.gallery-chrome');
 const w=innerWidth,h=innerHeight,q=parseAperture(aperture,w,h);
 const duration=reducedMotion?180:direction==='portal'?960:920;
 const options=window.motionStudyOptions||{};
 const notify=data=>post({...data,requestId:options.requestId});
 const animations=[];
 const animate=(el,frames,extra={})=>{
  const a=el.animate(frames,{duration,easing:'linear',fill:'both',...extra});
  a.playbackRate=options.slow?.5:1;animations.push(a);return a;
 };
 const fx=document.createElement('div');fx.className='entry-fx';fx.setAttribute('aria-hidden','true');dialog.append(fx);
 let done=false;
 const cleanup=()=>{
  if(done)return;done=true;
  // Keep the same clip compositing context before and after the handoff.
  // Removing it changes the backdrop-filter's sampling root on mobile Safari.
  dialog.style.clipPath='polygon(0% 0%,100% 0%,100% 100%,0% 100%)';
  for(const a of animations)a.cancel();
  fx.remove();
  hero.style.removeProperty('transform-origin');hero.style.removeProperty('will-change');
  if(active!==run)return;
  if(window.motionStudyOptions===options)window.motionStudyOptions=undefined;
  dialog.dataset.entryPhase='complete';running=[];finishCurrent=null;notify({state:'complete'});
 };
 finishCurrent=cleanup;
 dialog.dataset.entryPhase=direction;
 if(reducedMotion) {
  animate(dialog,[{opacity:0},{opacity:1}],{duration:180});
 } else {
  // Native gestures can interrupt either study at any time.
  hero.style.willChange='transform';hero.style.transformOrigin=portalCamera(q,w,h,0).origin;
  if(direction==='portal') {
   animate(dialog,sampled(t=>({opacity:smooth(t/.16)})));
   animate(dialog,sampled(t=>({clipPath:polygon(portalCamera(q,w,h,t).quad)})));
   animate(hero,sampled(t=>({transform:portalCamera(q,w,h,t).transform})));
   const sheen=document.createElement('div');sheen.className='entry-sheen';fx.append(sheen);
   animate(sheen,sampled(t=>({opacity:Math.sin(clamp(t/.70)*Math.PI)*.14,transform:'translateX('+mix(-32,55,out(t))+'%) rotate(-12deg)'})));
   // Animate content, never the scaled caption frame or the glass ancestor.
   for(const el of chrome.querySelectorAll('.gallery-wordmark,.gallery-back,.motion-control'))animate(el,sampled(t=>({opacity:smooth((t-.64)/.26)})));
   for(const el of [panel.title,panel.description,panel.link])animate(el,sampled(t=>({opacity:smooth((t-.64)/.26),translate:'0 '+mix(8,0,out((t-.64)/.26))+'px'})));
  } else {
   animate(dialog,sampled(t=>({clipPath:polygon(signalAperture(q,w,h,t))})));
   animate(hero,sampled(t=>({opacity:mix(1,.62,smooth(t/.7))})));
   for(const el of chrome.querySelectorAll('.gallery-wordmark,.gallery-back,.motion-control'))animate(el,sampled(t=>({opacity:smooth((t-.63)/.28)})));
   animate(panel.caption,sampled(t=>({opacity:smooth((t-.65)/.25)})));
   const image=drawScene(panel,w,h);
   const preview=document.createElement('canvas');preview.width=w;preview.height=h;preview.className='entry-lcd-preview';fx.append(preview);
   const pc=preview.getContext('2d');pc.drawImage(image,0,0);
   animate(preview,sampled(t=>({transform:projectiveMatrix(w,h,q.map(([x,y])=>[x+(t>.08&&t<.17?(Math.floor(t*duration/24)%2?1.5:-1):0),y])),opacity:1-smooth((t-.20)/.10)})));
   const scan=document.createElement('div');scan.className='entry-scan';fx.append(scan);
   animate(scan,sampled(t=>({opacity:Math.sin(clamp(t/.68)*Math.PI)*.16,backgroundPosition:'0 '+Math.round(t*18)+'px'})));
   const amount=Math.max(14,Math.min(36,w*.025));
   const bands=[{top:.10,height:.10,from:.27,to:.41,shift:1},{top:.20,height:.16,from:.29,to:.46,shift:-.8},{top:.36,height:.19,from:.31,to:.49,shift:1.15},{top:.55,height:.17,from:.33,to:.52,shift:-1},{top:.72,height:.16,from:.35,to:.54,shift:.7},{top:.88,height:.12,from:.37,to:.56,shift:-.55}];
   for(const b of bands) {
    const band=document.createElement('canvas');band.width=w;band.height=Math.ceil(h*b.height);band.className='entry-signal-band';fx.append(band);
    band.style.inset='auto';band.style.left='0';band.style.top=(h*b.top)+'px';band.style.height=band.height+'px';
    band.getContext('2d').drawImage(image,0,h*b.top,w,h*b.height,0,0,w,band.height);
    animate(band,sampled(t=>{
     const on=t>=b.from&&t<b.to,local=clamp((t-b.from)/(b.to-b.from));
     const displacement=local<.65?(Math.floor((t-b.from)*duration/34)%2?-.28:1):1-out((local-.65)/.35);
     return {opacity:on?1:0,transform:'translateX('+(on?b.shift*amount*displacement:0)+'px)'};
    }));
   }
  }
 }
 running=animations;
 notify({state:options.hold!==undefined?'paused':'playing',duration:duration/(options.slow?.5:1)});
 if(options.hold!==undefined){animations.forEach(a=>{a.pause();a.currentTime=clamp(options.hold)*duration;});dialog.dataset.entryPhase='paused';}
 Promise.allSettled(animations.map(a=>a.finished)).then(cleanup);
 const interrupt=()=>cleanup();
 for(const type of ['wheel','touchstart','keydown','pointerdown'])window.addEventListener(type,interrupt,{once:true,passive:true,capture:true});
 const onResize=()=>interrupt();window.addEventListener('resize',onResize,{once:true,passive:true});
 Promise.allSettled(animations.map(a=>a.finished)).then(()=>{
  for(const type of ['wheel','touchstart','keydown','pointerdown'])window.removeEventListener(type,interrupt,{capture:true});
  window.removeEventListener('resize',onResize);
 });
 return animations;
};
window.finishEntryPreview=()=>finishCurrent?.();
window.playExitPreview=({dialog,track,panel,aperture,reducedMotion})=>{
 finishCurrent?.();
 const hero=document.querySelector('.experience'),w=innerWidth,h=innerHeight,q=parseAperture(aperture,w,h);
 const animations=[],duration=reducedMotion?160:660;
 let done=false;
 const animate=(el,frames)=>{const a=el.animate(frames,{duration,easing:'linear',fill:'both'});animations.push(a);return a;};
 dialog.dataset.entryPhase='returning';
 const cleanup=()=>{
  if(done)return;done=true;
  window.removeEventListener('resize',cleanup);
  animations.forEach(a=>a.cancel());
  hero.style.removeProperty('transform-origin');hero.style.removeProperty('will-change');
  dialog.style.clipPath='polygon(0% 0%,100% 0%,100% 100%,0% 100%)';
  dialog.dataset.entryPhase='returned';finishCurrent=null;running=[];
 };
 finishCurrent=cleanup;
 if(reducedMotion)animate(dialog,[{opacity:1},{opacity:0}]);
 else{
  hero.style.transformOrigin=portalCamera(q,w,h,0).origin;hero.style.willChange='transform';
  // The same camera path runs backwards, with a shorter return duration.
  animate(dialog,sampled(t=>({clipPath:polygon(portalCamera(q,w,h,1-t).quad),opacity:1-smooth((t-.76)/.24)})));
  animate(hero,sampled(t=>({transform:portalCamera(q,w,h,1-t).transform})));
  for(const el of [panel.title,panel.description,panel.link,...dialog.querySelectorAll('.gallery-wordmark,.gallery-back,.motion-control')])animate(el,sampled(t=>({opacity:1-smooth(t/.28)})));
 }
 running=animations;
 window.addEventListener('resize',cleanup,{once:true,passive:true});
 Promise.allSettled(animations.map(a=>a.finished)).then(cleanup);
 return animations;
};
window.addEventListener('message',async event=>{
 if(event.source!==parent||event.origin!==location.origin||event.data?.type!=='motion-study')return;
 const {action,project,hold,slow,requestId}=event.data;
 latestRequest=requestId;
 if(action==='reset') {finishCurrent?.();window.resetMotionStudy?.();post({state:'ready',requestId});return;}
 if(action==='play'){
  await prepared;if(latestRequest!==requestId)return;
  finishCurrent?.();await Promise.resolve();
  window.motionStudyOptions={hold,slow,requestId};
  window.openMotionStudy?.(project);
 }
});
motionPreference.addEventListener('change',()=>finishCurrent?.());
const readyObserver=new MutationObserver(()=>{
 if(window.openMotionStudy&&document.querySelector('.scene.is-ready')&&!document.documentElement.classList.contains('is-loading')){readyObserver.disconnect();resolveReady();post({state:'ready'});}
});
readyObserver.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class']});
if(window.openMotionStudy&&document.querySelector('.scene.is-ready')&&!document.documentElement.classList.contains('is-loading')){readyObserver.disconnect();resolveReady();post({state:'ready'});}
