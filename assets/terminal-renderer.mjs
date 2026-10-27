import * as T from './terminal-volume/vendor/three.mjs';
import {createTerminalRenderer as createPhotoRenderer,waitForTerminalHome} from '/assets/terminal-photo-renderer.mjs';
import {construction,mobileConstruction,makeConstructionLayers} from '/assets/terminal-construction.mjs';
import {partTranslation,partProgress,boundInspection,revealWeight,revealComposition,revealFlight,scatterSlot,ambientTumble} from '/assets/terminal-scene-motion.mjs';
import {motionPreference} from '/assets/motion-preferences.mjs';
import {calibratedFrame} from './terminal-volume/calibration.mjs';
import {buildVolumeModel} from './terminal-volume/model.mjs';
import {createNativeSurfaces} from './terminal-volume/native-surfaces.mjs';
import {cleanRoomPatch} from './terminal-volume/room-clean.mjs';
import {bareBoard,bakeInteriors} from './terminal-volume/internal-skins.mjs';
import {loadEnvironment} from './terminal-volume/environment.mjs';

export async function createTerminalRenderer({stage,mobile,page=document,onProgress=()=>{}}){
  const boot={},started=performance.now();let checkpoint=started;const phase=id=>{const now=performance.now();boot[id]=Math.round(now-checkpoint);checkpoint=now;onProgress(id);};
  const base=await createPhotoRenderer({stage,mobile,page}),variant=mobile?mobileConstruction:construction,frame=calibratedFrame({mobile});
  await waitForTerminalHome(page);
  phase('photographicRenderer');
  const terminal=page.querySelector('.terminal'),photoRoot=terminal.querySelector('.te-parts-scene'),canvas=page.createElement('canvas');canvas.className='volume-canvas';canvas.setAttribute('aria-hidden','true');Object.assign(canvas.style,{position:'absolute',left:'0',top:'0',width:variant.width+'px',height:variant.height+'px',pointerEvents:'none',zIndex:'8',display:'none'});terminal.append(canvas);
  let renderer;try{renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});}catch{canvas.remove();return base;}renderer.setSize(variant.width,variant.height,false);renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.NoToneMapping;
  const scene=new T.Scene(),s=frame.scale,camera=new T.OrthographicCamera(-variant.width/2/s,variant.width/2/s,variant.height/2/s,-variant.height/2/s,.1,2000),right=new T.Vector3(...frame.right),up=new T.Vector3(...frame.up),normal=new T.Vector3(...frame.normal);
  const position=right.clone().multiplyScalar((variant.width/2-frame.origin[0])/s).addScaledVector(up,(frame.origin[1]-variant.height/2)/s).addScaledVector(normal,500);camera.position.copy(position);camera.up.copy(up);camera.lookAt(position.clone().sub(normal));camera.updateMatrixWorld(true);
  const view={x:0,y:0,width:variant.width,height:variant.height,scale:1};
  function refreshView({resizeBuffer=true}={}){const h=readHome(),v=page.querySelector('.experience').getBoundingClientRect();Object.assign(view,{x:-h.x/h.scale,y:-h.y/h.scale,width:v.width/h.scale,height:v.height/h.scale,scale:h.scale});camera.left=(view.x-variant.width/2)/s;camera.right=(view.x+view.width-variant.width/2)/s;camera.top=(variant.height/2-view.y)/s;camera.bottom=(variant.height/2-view.y-view.height)/s;camera.updateProjectionMatrix();if(!resizeBuffer)return;const ratio=Math.min(devicePixelRatio,2);if(renderer.getPixelRatio()!==ratio)renderer.setPixelRatio(ratio);const size=renderer.getSize(new T.Vector2());if(size.x!==v.width||size.y!==v.height)renderer.setSize(v.width,v.height,false);}
  refreshView();
  scene.add(new T.HemisphereLight('#f6e7dc','#665368',1.1));const light=new T.DirectionalLight('#fff0db',2.2);light.position.copy(position).addScaledVector(right,-120).addScaledVector(up,150);scene.add(light);const fill=new T.DirectionalLight('#e5d7e9',.6);fill.position.copy(position).addScaledVector(right,100);scene.add(fill);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;light.castShadow=true;light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-350,right:350,top:350,bottom:-350,near:1,far:1800});light.shadow.bias=-.0002;light.shadow.normalBias=.2;light.shadow.radius=4;
  const environment=await loadEnvironment(T,renderer);scene.environment=environment.texture;scene.environmentIntensity=.4;boot.environmentMode=environment.mode;
  await waitForTerminalHome(page);
  phase('environment');
  const texture=canvas=>{const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;return t;};
  const load=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src='/assets/'+src.slice(2);});
  const [housing,keycaps,boardMaterial,shellMaterial]=await Promise.all([load(variant.housing),load(variant.keycaps),load('./terminal-inner-board.webp'),load('./terminal-inner-shell.webp')]);
  await waitForTerminalHome(page);
  const layers=makeConstructionLayers({housing,keycaps,boardMaterial,shellMaterial,page,variant}),maps=new Map([...layers.layers].map(([id,c])=>[id,texture(c)]));const exterior=page.createElement('canvas');exterior.width=variant.width;exterior.height=variant.height;const ec=exterior.getContext('2d');ec.fillStyle='#d7c3ad';ec.fillRect(0,0,exterior.width,exterior.height);ec.save();ec.clip(new Path2D(variant.outer));ec.drawImage(housing,0,0);ec.restore();maps.set('rearExterior',texture(exterior));
  // Sample the same fitted room illumination as the photographic compositor.
  // No independent exposure or colour grade is introduced at the reference pose.
  const h0=readHome(),viewport=page.querySelector('.experience').getBoundingClientRect(),snapshots=new Map();
  for(const id of ['rear','board','display','housing']){const target=photoRoot.querySelector(`[data-part="${id}"] .te-art`);let c=target;if(id==='rear'||id==='board'){c=page.createElement('canvas');c.width=target.width;c.height=target.height;c.getContext('2d').drawImage(target,0,0);snapshots.set(id,{canvas:c,target});}const map=texture(c);map.repeat.set(variant.width*h0.scale/viewport.width,variant.height*h0.scale/viewport.height);map.offset.set(h0.x/viewport.width,1-(variant.height*h0.scale+h0.y)/viewport.height);maps.get(id)?.dispose();maps.set(id,map);}
  maps.set('boardBare',texture(bareBoard({source:layers.layers.get('board'),variant,frame,page})));
  phase('textures');
  function refreshMaps(){const h=readHome(),v=page.querySelector('.experience').getBoundingClientRect();for(const {canvas:c,target}of snapshots.values()){c.width=target.width;c.height=target.height;c.getContext('2d').drawImage(target,0,0);}for(const id of ['rear','board','display','housing']){const map=maps.get(id);map.repeat.set(variant.width*h.scale/v.width,variant.height*h.scale/v.height);map.offset.set(h.x/v.width,1-(variant.height*h.scale+h.y)/v.height);
    // Canvas dimensions changed with the viewport. Release immutable GPU
    // storage before uploading again, or the old dimensions crop the new skin.
    map.dispose();map.needsUpdate=true;}}
  const screen=page.querySelector('#terminal-display'),keys=[...page.querySelectorAll('.key')],pilot=page.querySelector('.pilot-light');
  const model=buildVolumeModel({frame,variant,textures:maps,page});scene.add(model.root);scene.updateMatrixWorld(true);scene.matrixWorldAutoUpdate=false;
  phase('geometry');
  const surfaces=createNativeSurfaces({terminal,photoRoot,screen,keys,pilot,model,frame,variant,renderer,scene,camera,canvas,view,page});
  let cleanKey='';
  function refreshRoom(){const h=readHome(),background=page.querySelector('.scene-extension'),key=[background.width,background.height,h.x,h.y,h.scale,page.querySelector('.scene-photo').currentSrc].join(':');if(key!==cleanKey){cleanKey=key;cleanRoomPatch({background,patch:photoRoot.querySelector('.te-room-patch'),variant,home:h,page});}}
  let skinKey='';
  function refreshSkins(){const h=readHome(),background=page.querySelector('.scene-extension'),key=[background.width,background.height,h.x,h.y,h.scale,page.querySelector('.scene-photo').currentSrc].join(':');if(key!==skinKey){refreshMaps();refreshRoom();bakeInteriors({model,renderer,scene,camera,canvas,photoRoot,variant,home:h,page});skinKey=key;surfaces.invalidate();}}
  const rotation=new Map([...model.parts.keys()].map(id=>[id,new T.Quaternion()])),offsets=new Map([...model.parts.keys()].map(id=>[id,{x:0,y:0}]));
  const layoutOffsets=new Map(),scales=new Map(),defaults=new Map(),corners=new Map();
  const identity=new T.Quaternion(),flightState=new Map([...model.parts.keys()].map(id=>[id,{weight:0,spin:new T.Quaternion(),curve:{x:0,y:0},anchorWeight:0,anchorSpin:new T.Quaternion(),anchorCurve:{x:0,y:0},reference:1}]));
  let flightDirection=1,firstFlight=true,entryProgress=0;
  for(const [id,part]of model.parts){const box=new T.Box3().setFromObject(part).translate(part.userData.pivot.clone().negate());corners.set(id,[...Array(8)].map((_,i)=>new T.Vector3(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z)));layoutOffsets.set(id,{x:0,y:0});scales.set(id,1);}
  let active=false,volume=false,disposed=false,gpuLost=false,progress=0,drag=null,tick=0,rotateMode=false,autoReveal=true,saved=[];const raycaster=new T.Raycaster(),pointer=new T.Vector2(),bindings=[],touches=new Map();
  const untouched=new Set(),ambientPrevious=new Map([...model.parts.keys()].map(id=>[id,new T.Quaternion()]));
  let ambientSeconds=0,ambientStamp=0,paintRequested=false;
  const canAdvanceAmbient=()=>active&&volume&&!gpuLost&&autoReveal&&progress>.3&&flightDirection===1&&!motionPreference?.matches&&!page.hidden&&untouched.size>0;
  const canTumble=()=>progress===1&&canAdvanceAmbient();
  function resetAmbient(){ambientSeconds=0;ambientStamp=0;for(const q of ambientPrevious.values())q.identity();}
  function touchPart(id){untouched.delete(id);}
  function advanceAmbient(time){
    const dt=ambientStamp?Math.min(.05,Math.max(0,(time-ambientStamp)/1000)):0;ambientStamp=time;ambientSeconds+=dt;
    for(const id of untouched){const a=ambientTumble(id,ambientSeconds),previous=ambientPrevious.get(id),next=new T.Quaternion().setFromAxisAngle(up,a.yaw).premultiply(new T.Quaternion().setFromAxisAngle(right,a.pitch)).premultiply(new T.Quaternion().setFromAxisAngle(normal,a.roll));rotation.get(id).premultiply(next.clone().multiply(previous.clone().invert())).normalize();previous.copy(next);}
    canvas.dataset.ambientTime=ambientSeconds.toFixed(3);
  }
  const smooth=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};
  function listen(target,type,fn,options){target.addEventListener(type,fn,options);bindings.push(()=>target.removeEventListener(type,fn,options));}
  function setPointer(value){const experience=page.querySelector('.experience');if((experience.dataset.terminalPointer||'')===value)return;if(value)experience.dataset.terminalPointer=value;else delete experience.dataset.terminalPointer;}
  function showVolume(on){if(volume===on)return;volume=on;canvas.style.display='none';photoRoot.dataset.volume=String(on);if(!on){setPointer('');surfaces.reset();}canvas.dataset.active=String(on);}
  function readHome(){const a=terminal.getBoundingClientRect(),b=page.querySelector('.experience').getBoundingClientRect();return {x:a.left-b.left,y:a.top-b.top,scale:parseFloat(getComputedStyle(page.documentElement).getPropertyValue('--scene-scale'))||1};}
  function compose(){
    resetAmbient();
    const h=readHome(),v=page.querySelector('.experience').getBoundingClientRect(),intro=page.querySelector('.introduction').getBoundingClientRect(),travel=Number(photoRoot.dataset.travel)||1,lift=Number(photoRoot.dataset.lift)||0;
    for(const [id,part]of model.parts){const pose=revealComposition(id,mobile),q=rotation.get(id);q.identity().premultiply(new T.Quaternion().setFromAxisAngle(up,pose.yaw)).premultiply(new T.Quaternion().setFromAxisAngle(right,pose.pitch)).premultiply(new T.Quaternion().setFromAxisAngle(normal,pose.roll));defaults.set(id,q.clone());
      const points=corners.get(id).map(p=>frame.project(p.clone().applyQuaternion(q).add(part.userData.pivot).toArray())),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),left=Math.min(...xs),top=Math.min(...ys),width=Math.max(...xs)-left,height=Math.max(...ys)-top;
      const slot=scatterSlot(id,{width:v.width,height:v.height-24,contentTop:mobile?intro.bottom-v.top+28:0,mobile}),scale=Math.min(1,Math.max(mobile?.72:.82,Math.min(slot.width/(width*h.scale),slot.height/(height*h.scale)))),pivot=frame.project(part.userData.pivot.toArray()),basePose=partTranslation(id,1,mobile);
      const halfWidth=width*h.scale*scale/2,halfHeight=height*h.scale*scale/2,targetX=halfWidth*2>v.width-24?v.width/2:Math.max(halfWidth+12,Math.min(v.width-halfWidth-12,slot.x)),targetY=halfHeight*2>v.height-24?v.height/2:Math.max(halfHeight+12,Math.min(v.height-halfHeight-12,slot.y));
      scales.set(id,scale);layoutOffsets.set(id,{x:(targetX-h.x)/h.scale-pivot[0]-(left+width/2-pivot[0])*scale-basePose.x*travel,y:(targetY-h.y)/h.scale-pivot[1]-(top+height/2-pivot[1])*scale-basePose.y*travel-lift});
    }
  }
  function update(){
    const travel=Number(photoRoot.dataset.travel)||1,lift=Number(photoRoot.dataset.lift)||0,clearanceWeight=smooth((progress-.12)/.6);
    for(const [id,part]of model.parts){
      const state=flightState.get(id);
      if(flightDirection===1){const flight=revealFlight(id,firstFlight?progress:(progress-entryProgress)/(1-entryProgress)),remaining=1-Math.min(1,flight.weight),curveScale=mobile?.65:1;state.weight=state.anchorWeight+(1-state.anchorWeight)*flight.weight;state.spin.copy(state.anchorSpin).slerp(identity,Math.min(1,flight.weight));state.curve.x=state.anchorCurve.x*remaining+(firstFlight?flight.x*curveScale:0);state.curve.y=state.anchorCurve.y*remaining+(firstFlight?flight.y*curveScale:0);
        if(firstFlight&&progress<1)state.spin.premultiply(new T.Quaternion().setFromAxisAngle(up,flight.yaw)).premultiply(new T.Quaternion().setFromAxisAngle(right,flight.pitch)).premultiply(new T.Quaternion().setFromAxisAngle(normal,flight.roll));
      }else{const fraction=state.reference?revealWeight(id,progress)/state.reference:0;state.weight=state.anchorWeight*fraction;state.spin.copy(state.anchorSpin).slerp(identity,1-Math.max(0,Math.min(1,fraction)));state.curve.x=state.anchorCurve.x*fraction;state.curve.y=state.anchorCurve.y*fraction;}
      const pose=partTranslation(id,progress,mobile),w=partProgress(id,progress),angleWeight=state.weight,local=offsets.get(id),layout=layoutOffsets.get(id),sourceOffset=photoRoot.querySelector(`[data-part="${id}"]`)?.dataset,dx=pose.x*travel+Number(sourceOffset?.offsetX||0)*w+(local.x+layout.x)*angleWeight+state.curve.x,dy=pose.y*travel+(lift+Number(sourceOffset?.offsetY||0))*w+(local.y+layout.y)*angleWeight+state.curve.y;
      const clearance={rear:-320,board:-160,display:0,housing:160,keys:320}[id];
      part.position.copy(part.userData.pivot).add(new T.Vector3(...frame.offset(dx,dy))).addScaledVector(normal,clearance*clearanceWeight);part.quaternion.identity().slerp(rotation.get(id),angleWeight).premultiply(state.spin);part.scale.setScalar(1+(scales.get(id)-1)*angleWeight);part.userData.nativeOffset={x:dx,y:dy};}
    scene.updateMatrixWorld(true);
    if(volume)surfaces.paint();
  }
  function draw(time){tick=0;if(disposed||!active)return;const drifting=canTumble();
    if(drifting&&ambientStamp&&time-ambientStamp<1000/60-1&&!paintRequested){tick=requestAnimationFrame(draw);return;}
    if(drifting)advanceAmbient(time);else ambientStamp=0;
    paintRequested=false;update();canvas.dataset.angles=JSON.stringify([...rotation].map(([id,q])=>[id,q.toArray()]));canvas.dataset.tumbling=JSON.stringify(drifting?[...untouched]:[]);
    if(drifting)tick=requestAnimationFrame(draw);
  }
  function wake(){paintRequested=true;if(!tick)tick=requestAnimationFrame(draw);}
  function hit(event,refresh=true){const experience=page.querySelector('.experience').getBoundingClientRect();pointer.set((event.clientX-experience.left)/experience.width*2-1,1-(event.clientY-experience.top)/experience.height*2);if(refresh)update();raycaster.setFromCamera(pointer,camera);return raycaster.intersectObject(model.root,true)[0];}
  function hover(event){
    if(event.pointerType==='touch')return;
    if(!active||gpuLost||progress<.999||!volume||event.target.closest?.('.pilot-light,[data-contact-entry],.motion-control')){setPointer('');return;}
    // Reuse the last drawn matrices. Hover needs a physical hit test, not a GPU
    // repaint, and must never revive the photographic hit areas.
    setPointer(drag?'grabbing':hit(event,false)?'grab':'');
  }
  function start(event){
    if(!active||gpuLost||progress<.999||event.button!==0||event.target.closest?.('.pilot-light,[data-contact-entry],.motion-control'))return;
    if(event.pointerType==='touch'){
      touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
      if(touches.size===2){const p=[...touches.values()],center={x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2},id=drag?.id||hit({clientX:center.x,clientY:center.y},false)?.object.userData.partId;if(id){event.preventDefault();event.stopImmediatePropagation();showVolume(true);drag={id,touch:true,x:center.x,y:center.y,angle:Math.atan2(p[1].y-p[0].y,p[1].x-p[0].x)};for(const pointer of touches.keys())terminal.setPointerCapture(pointer);touchPart(id);canvas.dataset.selected=id;wake();}return;}
      if(!volume)return;
    }
    const rotate=rotateMode||event.shiftKey||event.altKey;if(!volume&&!rotate)return;const found=hit(event,false);if(!found)return;
    event.preventDefault();event.stopImmediatePropagation();showVolume(true);const id=found.object.userData.partId;touchPart(id);drag={id,pointer:event.pointerId,x:event.clientX,y:event.clientY};if(event.pointerType!=='touch')setPointer('grabbing');terminal.setPointerCapture(event.pointerId);canvas.dataset.selected=id;wake();
  }
  function move(event){
    if(touches.has(event.pointerId))touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(drag?.touch&&touches.size===2){event.preventDefault();event.stopImmediatePropagation();const p=[...touches.values()],x=(p[0].x+p[1].x)/2,y=(p[0].y+p[1].y)/2,angle=Math.atan2(p[1].y-p[0].y,p[1].x-p[0].x),q=rotation.get(drag.id);q.premultiply(new T.Quaternion().setFromAxisAngle(up,(x-drag.x)*.008)).premultiply(new T.Quaternion().setFromAxisAngle(right,(y-drag.y)*.008)).premultiply(new T.Quaternion().setFromAxisAngle(normal,angle-drag.angle)).normalize();drag.x=x;drag.y=y;drag.angle=angle;wake();return;}
    if(!drag||drag.pointer!==event.pointerId){hover(event);if(volume&&touches.has(event.pointerId))event.stopImmediatePropagation();return;}event.preventDefault();if(event.pointerType!=='touch')setPointer('grabbing');const dx=event.clientX-drag.x,dy=event.clientY-drag.y;drag.x=event.clientX;drag.y=event.clientY;
    if(rotateMode||event.shiftKey||event.altKey){const q=rotation.get(drag.id),yaw=new T.Quaternion().setFromAxisAngle(up,dx*.008),pitch=new T.Quaternion().setFromAxisAngle(right,dy*.008);q.premultiply(yaw).premultiply(pitch).normalize();}
    else{const o=offsets.get(drag.id),h=readHome(),v=page.querySelector('.experience').getBoundingClientRect();offsets.set(drag.id,boundInspection({x:o.x+dx/h.scale,y:o.y+dy/h.scale},v.width/h.scale,v.height/h.scale));}wake();}
  function end(event){
    const tracked=touches.delete(event.pointerId);
    if(tracked&&drag?.touch&&touches.size<2){const remaining=touches.entries().next().value;drag=remaining?{id:drag.id,pointer:remaining[0],...remaining[1]}:null;}
    if(drag?.pointer===event.pointerId)drag=null;
    if(terminal.hasPointerCapture(event.pointerId))terminal.releasePointerCapture(event.pointerId);
    hover(event);
  }
  listen(page,'pointerdown',start,true);listen(page,'pointermove',move,{capture:true,passive:false});for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(page,type,end,true);
  listen(page,'pointerout',event=>{if(!event.relatedTarget)setPointer('');},true);listen(page.defaultView,'blur',()=>setPointer(''));
  listen(page,'keydown',event=>{if(!active||gpuLost||event.target.closest?.('input,textarea'))return;
    if(event.key.toLowerCase()==='r'){event.preventDefault();rotateMode=!rotateMode;showVolume(true);canvas.dataset.mode=rotateMode?'rotate':'move';wake();}
    if(event.key==='0'){event.preventDefault();autoReveal=false;untouched.clear();for(const [id,q]of rotation){q.identity();defaults.set(id,q.clone());layoutOffsets.set(id,{x:0,y:0});scales.set(id,1);}for(const o of offsets.values())o.x=o.y=0;showVolume(false);base.resetInspection?.();base.render(progress);}
    const id=event.target.closest?.('[data-part]')?.dataset.part,directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
    if(id&&directions[event.key]&&event.shiftKey&&!volume)showVolume(true);
    if(volume&&id&&directions[event.key]){event.preventDefault();event.stopImmediatePropagation();touchPart(id);const [x,y]=directions[event.key];if(rotateMode||event.shiftKey){const q=rotation.get(id);q.premultiply(new T.Quaternion().setFromAxisAngle(up,x*.12)).premultiply(new T.Quaternion().setFromAxisAngle(right,y*.12)).normalize();}else{const o=offsets.get(id),h=readHome(),v=page.querySelector('.experience').getBoundingClientRect();offsets.set(id,boundInspection({x:o.x+x*8/h.scale,y:o.y+y*8/h.scale},v.width/h.scale,v.height/h.scale));}wake();}
    if(volume&&id&&event.key==='Home'){event.preventDefault();event.stopImmediatePropagation();touchPart(id);rotation.get(id).copy(defaults.get(id));offsets.set(id,{x:0,y:0});base.resetPart?.(id);update();wake();}
  },true);
  listen(page,'dblclick',event=>{if(!active||!volume)return;const found=hit(event);if(found){event.preventDefault();event.stopImmediatePropagation();const id=found.object.userData.partId;touchPart(id);rotation.get(id).copy(defaults.get(id));offsets.set(id,{x:0,y:0});base.resetPart?.(id);update();wake();}},true);
  listen(page,'visibilitychange',()=>{ambientStamp=0;if(!page.hidden)wake();});
  if(motionPreference)listen(motionPreference,'change',()=>{ambientStamp=0;wake();});
  listen(canvas,'webglcontextlost',event=>{event.preventDefault();gpuLost=true;showVolume(false);for(const q of rotation.values())q.identity();base.render(progress);});
  listen(canvas,'webglcontextrestored',()=>{gpuLost=false;skinKey='';base.refresh();refreshView();refreshSkins();surfaces.invalidate();wake();});
  canvas.dataset.renderer='source-registered-volumes';
  phase('bindings');
  const compiling=renderer.compileAsync(scene,camera);refreshRoom();phase('roomField');await compiling;
  await waitForTerminalHome(page);
  phase('shaders');
  refreshSkins();
  phase('interiorRestFrames');await surfaces.prepare();phase('gpuWarm');boot.totalMs=Math.round(performance.now()-started);canvas.dataset.boot=JSON.stringify(boot);
  return {mobile,
    activate(){saved=[screen,...keys].map(node=>[node,node.style.visibility]);surfaces.activate();active=true;autoReveal=true;base.activate();refreshView();refreshSkins();progress=0;
      flightDirection=1;firstFlight=true;entryProgress=0;for(const state of flightState.values()){state.weight=0;state.spin.identity();state.curve={x:0,y:0};state.anchorWeight=0;state.anchorSpin.identity();state.anchorCurve={x:0,y:0};state.reference=1;}
      untouched.clear();for(const id of model.parts.keys())untouched.add(id);compose();canvas.dataset.composition='organised-scatter';},
    render(value,{target=1}={}){if(target!==flightDirection){for(const [id,state]of flightState){state.anchorWeight=state.weight;state.anchorSpin.copy(state.spin);state.anchorCurve={...state.curve};state.reference=revealWeight(id,progress);}flightDirection=target;firstFlight=false;entryProgress=progress;}progress=value;canvas.dataset.progress=String(value);if(value<.999){drag=null;setPointer('');}base.render(value);if(autoReveal&&!gpuLost&&!volume&&value>.3)showVolume(true);if(canAdvanceAmbient())advanceAmbient(performance.now());else ambientStamp=0;update();if(volume&&value<.3){showVolume(false);base.render(value);}canvas.dataset.progress=String(value);canvas.dataset.tumbling=JSON.stringify(canAdvanceAmbient()?[...untouched]:[]);canvas.dataset.angles=JSON.stringify([...rotation].map(([id,q])=>[id,q.toArray()]));if(value===1&&canTumble())wake();},
    restore(){active=false;drag=null;rotateMode=false;touches.clear();untouched.clear();resetAmbient();canvas.dataset.tumbling='[]';cancelAnimationFrame(tick);tick=0;showVolume(false);for(const [node,v]of saved)node.style.visibility=v;for(const q of rotation.values())q.identity();for(const part of model.parts.values())part.scale.setScalar(1);for(const o of offsets.values())o.x=o.y=0;base.restore();},
    refresh(){
      // Complete the shared-camera update synchronously. No base-only frame,
      // stale GPU bake, or reset of the visitor's current rotation may escape.
      surfaces.captureHome();base.refresh();if(gpuLost){refreshRoom();return;}
      // Safari can detach the presented WebGL surface when its drawing buffer
      // is repeatedly resized while visible. Keep that allocation for this
      // inspection; camera and CSS follow the viewport. Activation sizes it
      // afresh. The final queued paint also covers a compositor resize commit.
      refreshView({resizeBuffer:false});refreshSkins();surfaces.invalidate();update();wake();
    },
    dispose(){if(disposed)return;this.restore();disposed=true;bindings.forEach(f=>f());surfaces.dispose();base.dispose();model.dispose();layers.dispose();environment.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();},
  };
}
