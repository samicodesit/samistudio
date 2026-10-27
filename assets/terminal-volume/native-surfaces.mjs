import * as T from './vendor/three.mjs';
import {projectiveMatrix} from '/assets/gallery-geometry.mjs';

// One GPU surface avoids five synchronous GPU-to-2D readbacks per frame.
// A depth-tested transparent screen window keeps the original live HTML screen
// between the display carrier and the solids in front of it.
export function createNativeSurfaces({terminal,photoRoot,screen,keys,pilot,model,frame,variant,renderer,scene,camera,canvas,view,page=document}){
 const saved=new Map([screen,pilot,...keys].map(node=>[node,{visibility:node.style.visibility,opacity:node.style.opacity,transform:node.style.transform,translate:node.style.translate,zIndex:node.style.zIndex}]));
 const identity=new T.Quaternion(),normal=new T.Vector3(...frame.normal),clones=[],corners=new Map();
 for(const [id,part]of model.parts){const box=new T.Box3().setFromObject(part).translate(part.userData.pivot.clone().negate());corners.set(id,[...Array(8)].map((_,i)=>new T.Vector3(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z)));
  const handle=photoRoot.querySelector(`[data-part="${id}"] .te-part-handle`),name=handle.getAttribute('aria-label').split('.')[0];handle.setAttribute('aria-label',name+'. Drag to move. Shift-drag or two fingers to rotate. Shift plus arrow keys rotate. Home resets.');
 }
 const labelQuads=keys.map((key,i)=>{const label=key.querySelector('.key-label'),clone=label.cloneNode(true);clone.classList.add('volume-label');Object.assign(clone.style,{left:'0',top:'0',position:'absolute',zIndex:'9',visibility:'hidden'});terminal.append(clone);clones.push(clone);const m=new DOMMatrix(getComputedStyle(label).transform),k=variant.keyPaths[i];return [[0,0],[label.offsetWidth,0],[label.offsetWidth,label.offsetHeight],[0,label.offsetHeight]].map(([x,y])=>{const p=new DOMPoint(x,y).matrixTransform(m);return [p.x/p.w+k.x,p.y/p.w+k.y];});});
 const lcd=page.createElement('canvas');lcd.className='volume-lcd';lcd.setAttribute('aria-hidden','true');Object.assign(lcd.style,{position:'absolute',inset:'0',width:'100%',height:'100%',zIndex:'-1',pointerEvents:'none',display:'none'});screen.prepend(lcd);
 const style=page.createElement('style');style.textContent='#terminal-display[data-shell="true"] .volume-lcd{visibility:hidden}.te-parts-scene[data-volume="true"] .te-layer[data-rotated="true"] .te-part-handle:focus-visible{background:transparent}';terminal.append(style);
 const maskGeometry=new T.BufferGeometry(),positions=variant.screen.flatMap(p=>frame.unproject(p,-2.67).map((v,i)=>v-model.parts.get('display').userData.pivot.getComponent(i)));maskGeometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));maskGeometry.setIndex([0,1,2,0,2,3]);
 const maskMaterial=new T.MeshBasicMaterial({transparent:true,blending:T.CustomBlending,blendSrc:T.ZeroFactor,blendDst:T.ZeroFactor,blendSrcAlpha:T.ZeroFactor,blendDstAlpha:T.ZeroFactor,depthTest:true,depthWrite:true,side:T.DoubleSide,toneMapped:false});
 const mask=new T.Mesh(maskGeometry,maskMaterial),maskScene=new T.Scene();mask.matrixAutoUpdate=false;maskScene.matrixWorldAutoUpdate=false;maskScene.add(mask);
 const shadowLight=scene.children.find(light=>light.isDirectionalLight&&light.castShadow),smooth=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};
 let screenTransform=screen.style.transform,lcdKey='';
 const home=terminal.getBoundingClientRect(),pr=pilot.getBoundingClientRect(),scale=parseFloat(getComputedStyle(page.documentElement).getPropertyValue('--scene-scale'))||1,pilotPoint=[(pr.left+pr.width/2-home.left)/scale,(pr.top+pr.height/2-home.top)/scale];
 function project(point,z,id){const part=model.parts.get(id),p=new T.Vector3(...frame.unproject(point,z)).sub(part.userData.pivot);part.localToWorld(p);return frame.project(p.toArray());}
 function front(id){return new T.Vector3(0,0,-1).applyQuaternion(model.parts.get(id).quaternion).dot(normal)>0;}
 function prepareLCD(){
  const bg=page.querySelector('.scene-extension'),t=terminal.getBoundingClientRect(),v=page.querySelector('.experience').getBoundingClientRect(),s=parseFloat(getComputedStyle(page.documentElement).getPropertyValue('--scene-scale'))||1,key=[bg.width,bg.height,t.left,t.top,s].join(':');if(key===lcdKey)return;lcdKey=key;
  const w=screen.offsetWidth,h=screen.offsetHeight,dpr=bg.width/v.width,m=new DOMMatrix(projectiveMatrix(w,h,variant.screen.map(([x,y])=>[(t.left-v.left+x*s)*dpr,(t.top-v.top+y*s)*dpr]))),source=bg.getContext('2d',{willReadFrequently:true}).getImageData(0,0,bg.width,bg.height).data;
  lcd.width=w*2;lcd.height=h*2;const ctx=lcd.getContext('2d'),image=ctx.createImageData(lcd.width,lcd.height);
  for(let y=0;y<lcd.height;y++)for(let x=0;x<lcd.width;x++){const px=(x+.5)/2,py=(y+.5)/2,z=m.m14*px+m.m24*py+1,sx=(m.m11*px+m.m21*py+m.m41)/z,sy=(m.m12*px+m.m22*py+m.m42)/z,ix=Math.max(0,Math.min(bg.width-2,Math.floor(sx))),iy=Math.max(0,Math.min(bg.height-2,Math.floor(sy))),fx=sx-ix,fy=sy-iy,i=(iy*bg.width+ix)*4,j=(y*lcd.width+x)*4;for(let c=0;c<3;c++)image.data[j+c]=(source[i+c]*(1-fx)+source[i+4+c]*fx)*(1-fy)+(source[i+bg.width*4+c]*(1-fx)+source[i+bg.width*4+4+c]*fx)*fy;image.data[j+3]=255;}ctx.putImageData(image,0,0);
 }
 function fitShadow(ids){if(!shadowLight)return;shadowLight.shadow.updateMatrices(shadowLight);const c=shadowLight.shadow.camera,points=ids.flatMap(id=>corners.get(id).map(p=>model.parts.get(id).localToWorld(p.clone()).applyMatrix4(c.matrixWorldInverse))),xs=points.map(p=>p.x),ys=points.map(p=>p.y);Object.assign(c,{left:Math.min(...xs)-3,right:Math.max(...xs)+3,bottom:Math.min(...ys)-3,top:Math.max(...ys)+3});c.updateProjectionMatrix();}
 function reset(){canvas.style.display='none';for(const art of photoRoot.querySelectorAll('.te-art'))art.style.opacity='1';for(const clone of clones)clone.style.visibility='hidden';for(const [node,styles]of saved)Object.assign(node.style,styles);screen.style.transform=screenTransform;lcd.style.display='none';}
 function paint(){
  const blend=smooth(Math.max(...[...model.parts.values()].map(part=>Math.max(part.quaternion.angleTo(identity)/.035,Math.abs(part.scale.x-1)/.02))));
  Object.assign(canvas.style,{display:blend?'block':'none',left:view.x+'px',top:view.y+'px',width:view.width+'px',height:view.height+'px',opacity:String(blend),zIndex:'8'});
  for(const [id,part]of model.parts){const p=part.userData.nativeOffset,group=photoRoot.querySelector(`[data-part="${id}"]`);group.style.transform=p.x||p.y?`translate3d(${p.x}px,${p.y}px,0)`:'none';group.querySelector('.te-art').style.opacity=String(1-blend);group.dataset.rotated=String(blend>0);}
  if(blend){
   renderer.setScissorTest(false);renderer.autoClear=true;for(const [id,part]of model.parts)part.visible=id!=='housing'&&id!=='keys';fitShadow(['rear','board','display']);renderer.render(scene,camera);
   renderer.autoClear=false;if(front('display')){mask.matrix.copy(model.parts.get('display').matrixWorld);mask.matrixWorld.copy(mask.matrix);renderer.render(maskScene,camera);}
   for(const [id,part]of model.parts)part.visible=id==='housing'||id==='keys';fitShadow(['housing','keys']);renderer.render(scene,camera);renderer.autoClear=true;
  }
  for(const part of model.parts.values())part.visible=true;
  const d=model.parts.get('display'),k=model.parts.get('keys'),h=model.parts.get('housing');screen.style.zIndex='7';screen.style.visibility=saved.get(screen).visibility;
  if(blend){screen.style.translate='none';screen.style.transform=projectiveMatrix(screen.offsetWidth,screen.offsetHeight,variant.screen.map(p=>project(p,-2.65,'display')));screen.style.visibility=front('display')?'visible':'hidden';lcd.style.display='block';}
  else{screen.style.transform=screenTransform;screen.style.translate=`${d.userData.nativeOffset.x}px ${d.userData.nativeOffset.y}px`;lcd.style.display='none';}
  for(const [i,key]of keys.entries()){const clone=clones[i];key.style.visibility=saved.get(key).visibility;key.style.opacity=blend?String(1-blend):saved.get(key).opacity;key.style.translate=`${k.userData.nativeOffset.x}px ${k.userData.nativeOffset.y}px`;clone.style.visibility=blend&&front('keys')?'visible':'hidden';clone.style.opacity=String(blend);if(blend)clone.style.transform=projectiveMatrix(clone.offsetWidth,clone.offsetHeight,labelQuads[i].map(p=>project(p,-10.05,'keys')));}
  pilot.style.opacity=String(1-blend);const pp=blend?project(pilotPoint,-4.6,'housing'):[pilotPoint[0]+h.userData.nativeOffset.x,pilotPoint[1]+h.userData.nativeOffset.y];pilot.style.translate=`${pp[0]-pilotPoint[0]}px ${pp[1]-pilotPoint[1]}px`;
  if(Number(canvas.dataset.progress)>.99){const factor=view.scale;canvas.dataset.parts=JSON.stringify([...model.parts].map(([id,part])=>{const points=corners.get(id).map(p=>frame.project(part.localToWorld(p.clone()).toArray())),xs=points.map(p=>(p[0]-view.x)*factor),ys=points.map(p=>(p[1]-view.y)*factor);return {id,scale:part.scale.x,rect:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]};}));}
 }
 return {paint,reset,captureHome(){screenTransform=screen.style.transform;},async prepare(){await renderer.compileAsync(maskScene,camera);renderer.render(scene,camera);mask.matrix.copy(model.parts.get('display').matrixWorld);mask.matrixWorld.copy(mask.matrix);renderer.autoClear=false;renderer.render(maskScene,camera);renderer.autoClear=true;},invalidate(){lcdKey='';prepareLCD();},activate(){screenTransform=screen.style.transform;prepareLCD();},dispose(){reset();clones.forEach(c=>c.remove());lcd.remove();style.remove();maskGeometry.dispose();maskMaterial.dispose();}};
}
