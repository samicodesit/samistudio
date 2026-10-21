import {construction,mobileConstruction,makeConstructionLayers} from './terminal-construction.mjs';
import {createCleanTerminalPlate} from './terminal-room.mjs';
import {partTranslation,partProgress,handoffBlend,boundInspection,fitExplosion,partExtents} from './terminal-scene-motion.mjs';

// The homepage camera never moves. Only registered parts receive translations.
export async function createTerminalRenderer({stage,mobile,page=document}){
  const variant=mobile?mobileConstruction:construction;
  const load=path=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Terminal artwork unavailable'));image.src=new URL(path,import.meta.url).href;});
  const [housing,keycaps,boardMaterial,shellMaterial]=await Promise.all([load(variant.housing),load(variant.keycaps),load('./terminal-inner-board.webp'),load('./terminal-inner-shell.webp')]);
  const built=makeConstructionLayers({housing,keycaps,boardMaterial,shellMaterial,page,variant});
  const clean=createCleanTerminalPlate(housing,{mobile,page});
  const root=page.createElement('div');root.className='te-parts-scene';root.hidden=true;page.querySelector('.terminal').append(root);
  const order=['rear','board','display','housing','keys'],groups=new Map(),home={x:0,y:0,scale:1};
  let live=[],active=false,disposed=false,lastProgress=0,bakedKey='',drag=null;
  const offsets=new Map(order.map(id=>[id,{x:0,y:0}]));
  const makeCanvas=()=>{const c=page.createElement('canvas');c.setAttribute('aria-hidden','true');return c;};
  const patch=makeCanvas();patch.className='te-room-patch';root.append(patch);
  const matrix=variant.projection||[4.38,-.35,.9,4.55,130,280];
  const point=(x,y)=>[matrix[0]*x+matrix[2]*y+matrix[4],matrix[1]*x+matrix[3]*y+matrix[5]].join(' ');
  const boardPath=`M ${point(7,7)} L ${point(93,7)} L ${point(93,93)} L ${point(7,93)} Z`;
  const keyPath=variant.keyPaths.map(k=>`M ${k.x} ${k.y} h ${k.w} v ${k.h} h ${-k.w} Z`).join(' ');
  const hitPaths={rear:variant.outer,board:boardPath,display:variant.bezel,housing:variant.face+' '+variant.bezel+' '+keyPath,keys:keyPath};
  const names={rear:'Rear enclosure',board:'Circuit board',display:'Display assembly',housing:'Front enclosure',keys:'Keycaps'};
  function setOffset(id,offset){
    const box=page.querySelector('.experience').getBoundingClientRect();
    offsets.set(id,boundInspection(offset,box.width/home.scale,box.height/home.scale));render(lastProgress);
  }
  function endDrag(event){if(!drag||event.pointerId!==drag.pointer)return;drag=null;delete root.dataset.dragging;}
  for(const id of order){
    const group=page.createElement('div');group.className='te-layer';group.dataset.part=id;
    const art=makeCanvas();art.className='te-art';group.append(art);
    const hit=page.createElement('button');hit.type='button';hit.className='te-part-handle';hit.setAttribute('aria-label',names[id]+'. Drag to inspect. Arrow keys move. Home resets.');
    hit.style.width=variant.width+'px';hit.style.height=variant.height+'px';hit.style.clipPath=`path(${id==='housing'?'evenodd, ':''}'${hitPaths[id]}')`;group.append(hit);
    hit.addEventListener('pointerdown',event=>{if(lastProgress<.999||event.button!==0)return;event.preventDefault();event.stopPropagation();drag={id,pointer:event.pointerId,x:event.clientX,y:event.clientY,offset:{...offsets.get(id)}};hit.setPointerCapture(event.pointerId);root.dataset.dragging=id;});
    hit.addEventListener('pointermove',event=>{if(drag?.id!==id||drag.pointer!==event.pointerId)return;setOffset(id,{x:drag.offset.x+(event.clientX-drag.x)/home.scale,y:drag.offset.y+(event.clientY-drag.y)/home.scale});});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])hit.addEventListener(type,endDrag);
    hit.addEventListener('dblclick',()=>setOffset(id,{x:0,y:0}));
    hit.addEventListener('keydown',event=>{const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(event.key==='Home'){event.preventDefault();setOffset(id,{x:0,y:0});}else if(directions[event.key]){event.preventDefault();event.stopPropagation();const [x,y]=directions[event.key],step=(event.shiftKey?24:8)/home.scale,offset=offsets.get(id);setOffset(id,{x:offset.x+x*step,y:offset.y+y*step});}});
    root.append(group);groups.set(id,{group,art,hit});
  }
  const reference=makeCanvas();reference.className='te-reference';root.append(reference);
  function readHome(){
    const css=getComputedStyle(page.documentElement),terminal=page.querySelector('.terminal').getBoundingClientRect(),experience=page.querySelector('.experience').getBoundingClientRect();
    home.x=terminal.left-experience.left;home.y=terminal.top-experience.top;home.scale=parseFloat(css.getPropertyValue('--scene-scale'))||1;home.lift=0;
    let bottom=experience.height-8;
    if(mobile){
      const control=page.querySelector('.motion-label')?.getBoundingClientRect(),intro=page.querySelector('.introduction')?.getBoundingClientRect();
      if(control&&home.x+408*home.scale>control.left-experience.left)bottom=Math.min(bottom,control.top-experience.top-4);
      const top=(intro?.bottom??experience.top)-experience.top+12;
      const expandedBottom=home.y+Math.max(...Object.entries(partExtents.mobile).map(([id,box])=>box[3]+partTranslation(id,1,true).y))*home.scale;
      home.lift=-Math.min(Math.max(0,(expandedBottom-bottom)/home.scale),Math.max(0,(home.y+365*home.scale-top)/home.scale));
    }
    home.travel=fitExplosion({mobile,x:home.x,y:home.y+home.lift*home.scale,scale:home.scale,width:experience.width,height:bottom+8});root.dataset.travel=String(home.travel);root.dataset.lift=String(home.lift);
  }
  function binaryMask(path,w,h,dpr){
    const c=makeCanvas();c.width=w;c.height=h;const ctx=c.getContext('2d',{willReadFrequently:true});
    ctx.setTransform(home.scale*dpr,0,0,home.scale*dpr,home.x*dpr,home.y*dpr);ctx.fill(path);
    const image=ctx.getImageData(0,0,w,h);for(let i=3;i<image.data.length;i+=4)image.data[i]=image.data[i]>0?255:0;ctx.setTransform(1,0,0,1,0,0);ctx.putImageData(image,0,0);return c;
  }
  function photoSprite(target,mask,source,w,h,dpr){
    target.width=w;target.height=h;target.style.width=w/dpr+'px';target.style.height=h/dpr+'px';
    target.style.transformOrigin='0 0';target.style.transform=`translate(${-home.x/home.scale}px,${-home.y/home.scale}px) scale(${1/home.scale})`;
    const ctx=target.getContext('2d');ctx.drawImage(source,0,0);ctx.globalCompositeOperation='destination-in';ctx.drawImage(mask,0,0);ctx.globalCompositeOperation='source-over';
  }
  function sourceSprite(target,source,w,h,dpr){
    target.width=w;target.height=h;target.style.width=w/dpr+'px';target.style.height=h/dpr+'px';
    target.style.transformOrigin='0 0';target.style.transform=`translate(${-home.x/home.scale}px,${-home.y/home.scale}px) scale(${1/home.scale})`;
    const ctx=target.getContext('2d');ctx.setTransform(home.scale*dpr,0,0,home.scale*dpr,home.x*dpr,home.y*dpr);ctx.drawImage(source,0,0);ctx.setTransform(1,0,0,1,0,0);
  }
  function refresh(){
    if(disposed)return;readHome();
    const background=page.querySelector('.scene-extension'),w=background.width,h=background.height,dpr=w/page.querySelector('.experience').getBoundingClientRect().width;
    const key=[w,h,home.x,home.y,home.scale,page.querySelector('.scene-photo').currentSrc].join(':');
    // Intent has already baked this viewport. Activation performs no pixel readback.
    if(key===bakedKey){render(lastProgress);return;}bakedKey=key;
    const outer=binaryMask(built.paths.outer,w,h,dpr),face=binaryMask(built.paths.face,w,h,dpr),bezel=binaryMask(built.paths.bezel,w,h,dpr);
    photoSprite(reference,outer,background,w,h,dpr);
    // One opaque compositor below a single source-art cover prevents the closing
    // luminance pulse caused by fading several overlapping surfaces at once.
    const rc=reference.getContext('2d');rc.globalCompositeOperation='destination-out';
    const aperture=new Path2D();variant.screen.forEach(([x,y],i)=>i?aperture.lineTo(x,y):aperture.moveTo(x,y));aperture.closePath();
    rc.drawImage(binaryMask(aperture,w,h,dpr),0,0);for(const path of built.paths.keys)rc.drawImage(binaryMask(path,w,h,dpr),0,0);rc.globalCompositeOperation='source-over';
    // This patch is clipped to the old device silhouette. Every room pixel outside it stays untouched.
    sourceSprite(patch,clean,w,h,dpr);const p=patch.getContext('2d');p.setTransform(1,0,0,1,0,0);p.globalCompositeOperation='destination-in';p.drawImage(outer,0,0);p.globalCompositeOperation='source-over';
    sourceSprite(groups.get('rear').art,built.layers.get('rear'),w,h,dpr);
    // Keep the actual photographed side wall, not a repainted approximation.
    const side=makeCanvas();photoSprite(side,outer,background,w,h,dpr);const s=side.getContext('2d');s.globalCompositeOperation='destination-out';s.drawImage(face,0,0);groups.get('rear').art.getContext('2d').drawImage(side,0,0);
    sourceSprite(groups.get('board').art,built.layers.get('board'),w,h,dpr);
    sourceSprite(groups.get('display').art,built.layers.get('display'),w,h,dpr);
    const displayPhoto=makeCanvas();photoSprite(displayPhoto,bezel,background,w,h,dpr);groups.get('display').art.getContext('2d').drawImage(displayPhoto,0,0);
    const housingMask=makeCanvas();sourceSprite(housingMask,built.layers.get('housing'),w,h,dpr);const hm=housingMask.getContext('2d',{willReadFrequently:true}),maskData=hm.getImageData(0,0,w,h);for(let i=3;i<maskData.data.length;i+=4)maskData.data[i]=maskData.data[i]>127?255:0;hm.setTransform(1,0,0,1,0,0);hm.putImageData(maskData,0,0);photoSprite(groups.get('housing').art,housingMask,background,w,h,dpr);
    // Key artwork, labels, depth, live screen and pilot are the original DOM nodes.
    groups.get('keys').art.hidden=true;
    render(lastProgress);
  }
  function keepNode(node,id,z){
    live.push({node,id,z,zIndex:node.style.zIndex,translate:node.style.translate,inert:node.inert});node.inert=id!=='housing';
  }
  function activate(){
    if(active||disposed)return;refresh();active=true;
    keepNode(page.querySelector('#terminal-display'),'display',3);for(const key of page.querySelectorAll('.key'))keepNode(key,'keys',6);keepNode(page.querySelector('.pilot-light'),'housing',7);
    stage.hidden=false;render(0);
  }
  function restore(){
    if(!active)return;active=false;drag=null;delete root.dataset.dragging;for(const id of order)offsets.set(id,{x:0,y:0});for(const item of live){item.node.style.zIndex=item.zIndex;item.node.style.translate=item.translate;item.node.inert=item.inert;}live=[];root.hidden=true;stage.hidden=true;
  }
  function render(value){
    lastProgress=Math.max(0,Math.min(1,value));
    const blend=handoffBlend(lastProgress),amount=blend.visible?lastProgress:0;
    if(lastProgress<.999&&drag){drag=null;delete root.dataset.dragging;}
    root.hidden=!active||!blend.visible;root.dataset.inspecting=String(active&&lastProgress>=.999);
    patch.style.opacity='1';reference.style.opacity=String(blend.reference);
    // Modest displacement keeps the device's actual scale and camera framing intact.
    for(const id of order){const pose=partTranslation(id,amount,mobile),offset=offsets.get(id),weight=partProgress(id,amount),x=pose.x*home.travel+offset.x*weight,y=pose.y*home.travel+(offset.y+home.lift)*weight,{group,art,hit}=groups.get(id);
      group.style.transform=x||y?`translate3d(${x}px,${y}px,0)`:'none';art.style.opacity='1';group.style.zIndex=String({rear:0,board:1,display:2,housing:4,keys:5}[id]);hit.tabIndex=lastProgress>=.999?0:-1;
      group.dataset.offsetX=String(offset.x);group.dataset.offsetY=String(offset.y);
      for(const item of live)if(item.id===id){item.node.style.translate=x||y?`${x}px ${y}px`:item.translate;item.node.style.zIndex=amount>0?String(item.z):item.zIndex;}
    }
    stage.dataset.progress=amount.toFixed(4);
  }
  refresh();
  return {mobile,activate,restore,refresh,render,dispose(){if(disposed)return;restore();disposed=true;root.remove();built.dispose();clean.width=clean.height=1;}};
}
