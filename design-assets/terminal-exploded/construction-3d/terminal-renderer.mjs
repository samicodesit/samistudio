import * as T from './vendor/terminal-three.mjs';
import {createTerminalModel} from './terminal-model.mjs';

export function createTerminalRenderer({canvas,reducedMotion,onSelect,onError}){
  const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  const scene=new T.Scene(),camera=new T.OrthographicCamera(-100,100,100,-100,.1,1500);
  const pmrem=new T.PMREMGenerator(renderer),room=new T.RoomEnvironment();
  const environment=pmrem.fromScene(room,.045);scene.environment=environment.texture;scene.environmentIntensity=.62;
  room.dispose();pmrem.dispose();
  const model=createTerminalModel(T);model.root.rotation.x=-.09;scene.add(model.root);
  const hemi=new T.HemisphereLight('#f5e6d6','#827380',2);scene.add(hemi);
  const key=new T.DirectionalLight('#fff0d4',4.6);key.position.set(-100,180,180);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-240,right:240,top:220,bottom:-220,near:1,far:700});
  key.shadow.bias=-.0003;key.shadow.normalBias=.35;key.shadow.radius=4;scene.add(key);
  const rim=new T.DirectionalLight('#e6d9f3',2.2);rim.position.set(160,70,-100);scene.add(rim);
  const fill=new T.DirectionalLight('#ffe5d0',1);fill.position.set(40,0,200);scene.add(fill);
  const floorGeometry=new T.PlaneGeometry(1400,1400),floorMaterial=new T.ShadowMaterial({opacity:.17});
  const floor=new T.Mesh(floorGeometry,floorMaterial);floor.rotation.x=-Math.PI/2;floor.position.y=-54;floor.receiveShadow=true;scene.add(floor);
  const raycaster=new T.Raycaster(),pointer=new T.Vector2(),box=new T.Box3(),center=new T.Vector3();
  let progress=0,from=0,target=0,start=0,duration=0,frame=0,disposed=false,drag=null,theta=-.63,phi=.24,width=1,height=1;
  const bindings=[];
  function listen(node,type,fn,options){node.addEventListener(type,fn,options);bindings.push(()=>node.removeEventListener(type,fn,options));}
  function framing(){
    // Bounds projected into camera space fit all parts at every rotation and viewport.
    model.root.updateMatrixWorld(true);box.setFromObject(model.root);box.getCenter(center);
    camera.position.set(center.x+Math.sin(theta)*Math.cos(phi)*500,center.y+Math.sin(phi)*500,center.z+Math.cos(theta)*Math.cos(phi)*500);
    camera.lookAt(center);camera.updateMatrixWorld();
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
      const v=new T.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse);
      minX=Math.min(minX,v.x);maxX=Math.max(maxX,v.x);minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y);
    }
    const aspect=width/height,half=Math.max((maxY-minY)/2,(maxX-minX)/2/aspect)*1.12;
    camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();
  }
  function draw(time=performance.now()){
    frame=0;if(disposed||document.hidden)return;
    if(duration){const t=Math.min(1,(time-start)/duration),ease=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;progress=from+(target-from)*ease;if(t===1)duration=0;}
    model.setSeparation(progress);framing();renderer.render(scene,camera);
    canvas.dataset.separation=progress.toFixed(3);
    if(duration)wake();
  }
  function wake(){if(!disposed&&!frame&&!document.hidden)frame=requestAnimationFrame(draw);}
  function setSeparation(value,{animate=false}={}){
    from=progress;target=Math.max(0,Math.min(1,Number(value)||0));
    duration=animate&&!reducedMotion.matches?1200*Math.max(.35,Math.abs(target-from)):0;start=performance.now();
    if(!duration)progress=target;wake();
  }
  function resize(){const r=canvas.getBoundingClientRect();width=Math.max(1,r.width);height=Math.max(1,r.height);renderer.setSize(width,height,false);wake();}
  const observer=new ResizeObserver(resize);observer.observe(canvas);
  listen(canvas,'pointerdown',event=>{if(event.button!==0)return;drag={id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,moved:false};canvas.setPointerCapture(event.pointerId);canvas.classList.add('is-dragging');});
  listen(canvas,'pointermove',event=>{
    if(!drag||drag.id!==event.pointerId)return;
    if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>5)drag.moved=true;
    if(drag.moved){theta=Math.max(-1.1,Math.min(.85,theta+(event.clientX-drag.lastX)*.006));phi=Math.max(-.22,Math.min(.65,phi+(event.clientY-drag.lastY)*.004));wake();}
    drag.lastX=event.clientX;drag.lastY=event.clientY;
  });
  function release(event){
    if(!drag||drag.id!==event.pointerId)return;
    const select=!drag.moved&&event.type==='pointerup';drag=null;canvas.classList.remove('is-dragging');
    if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
    if(select){const r=canvas.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);
      const hit=raycaster.intersectObject(model.root,true)[0];if(hit)onSelect?.(hit.object.userData.partId);
    }
  }
  for(const event of ['pointerup','pointercancel','lostpointercapture'])listen(canvas,event,release);
  listen(canvas,'webglcontextlost',event=>{event.preventDefault();cancelAnimationFrame(frame);frame=0;onError?.(new Error('Graphics paused. Please try again.'));});
  listen(document,'visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else{if(duration)start=performance.now();wake();}});
  const motion=()=>{if(reducedMotion.matches){duration=0;progress=target;wake();}};reducedMotion.addEventListener('change',motion);
  resize();
  return {model,setSeparation,resetView(){theta=-.63;phi=.24;wake();},
    select(id){for(const [partId,group]of model.parts){group.traverse(mesh=>{if(!mesh.isMesh)return;const m=mesh.material;if(!m.userData.originalEmissive)m.userData.originalEmissive={color:m.emissive.clone(),intensity:m.emissiveIntensity};});}
      // Selection is communicated in the part list. Geometry keeps its true material.
      canvas.dataset.selected=id;wake();},
    dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);observer.disconnect();bindings.forEach(remove=>remove());reducedMotion.removeEventListener('change',motion);model.dispose();environment.dispose();floorGeometry.dispose();floorMaterial.dispose();renderer.dispose();renderer.forceContextLoss();},
  };
}
