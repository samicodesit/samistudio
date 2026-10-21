import {construction,makeConstructionLayers,layerPose} from './terminal-construction.mjs';
import {projectiveMatrix} from './gallery-geometry.mjs';

export async function createTerminalRenderer({canvas,reducedMotion,onSelect}){
  const load=path=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Assembly artwork could not load.'));img.src=new URL(path,import.meta.url).href;});
  const [housing,keycaps]=await Promise.all([load(construction.housing),load(construction.keycaps)]);
  const built=makeConstructionLayers({housing,keycaps}),ctx=canvas.getContext('2d');
  if(!ctx){built.dispose();throw new Error('Canvas is unavailable.');}
  const order=['rear','board','display','housing','keys'];
  // Tight transparent bounds keep phone animation and retained canvas memory small.
  const crop={x:40,y:230,width:655,height:565};
  for(const [id,full]of built.layers){const sprite=document.createElement('canvas');sprite.width=crop.width;sprite.height=crop.height;const paint=sprite.getContext('2d',{willReadFrequently:true});paint.drawImage(full,crop.x,crop.y,crop.width,crop.height,0,0,crop.width,crop.height);full.width=full.height=1;built.layers.set(id,sprite);}
  const foreground=document.createElement('canvas');foreground.className='te-foreground';foreground.setAttribute('aria-hidden','true');canvas.parentElement.append(foreground);const frontContext=foreground.getContext('2d');
  const original=document.querySelector('#terminal-display'),screen=original.cloneNode(true);
  const screenWidth=parseFloat(getComputedStyle(original).width),screenHeight=parseFloat(getComputedStyle(original).height);
  screen.removeAttribute('id');for(const node of screen.querySelectorAll('[id]'))node.removeAttribute('id');
  screen.querySelector('.terminal-reflection')?.remove();screen.setAttribute('aria-hidden','true');screen.inert=true;screen.classList.add('te-photo-screen');
  const title=screen.querySelector('.display-topline>button:first-child');
  if(title){const sourceStyle=getComputedStyle(original.querySelector('.display-topline>button:first-child'));for(const property of ['border','background','padding','margin','color','font','letter-spacing','line-height','text-align'])title.style.setProperty(property,sourceStyle.getPropertyValue(property));}
  screen.style.width=screenWidth+'px';screen.style.height=screenHeight+'px';canvas.parentElement.append(screen);
  const legends=document.createElement('div');legends.className='te-photo-legends';legends.setAttribute('aria-hidden','true');
  const faceQuads=[[[24,18],[112,6],[133,79],[41,92]],[[26,17],[116,7],[139,77],[43,90]],[[25,17],[115,6],[136,77],[43,90]]];
  for(const [i,source]of [...document.querySelectorAll('.key')].entries()){
    const label=source.querySelector('.key-label').cloneNode(true),wrap=document.createElement('span'),k=construction.keyPaths[i];
    wrap.className='te-photo-key';wrap.style.left=k.x+'px';wrap.style.top=k.y+'px';label.style.transform=projectiveMatrix(106,78,faceQuads[i]);wrap.append(label);legends.append(wrap);
  }
  canvas.parentElement.append(legends);
  let frame=0,disposed=false,progress=0,from=0,target=0,start=0,duration=0,width=1,height=1,pose={scale:1,x:0,y:0},selected=null,focus=false,drag=null,panX=0,panY=0,viewFrom=null,viewStart=0,viewDuration=0,emphasis=0,emphasisFrom=0;
  const offset=id=>layerPose(id,progress,width<600&&height>350?{x:.34,y:.85}:{x:1,y:.23});
  const listeners=[];
  function listen(node,type,fn,options){node.addEventListener(type,fn,options);listeners.push(()=>node.removeEventListener(type,fn,options));}
  function wake(){if(!frame&&!disposed&&!document.hidden)frame=requestAnimationFrame(draw);}
  function fit(){
    const a=offset('rear'),b=offset('keys'),minX=46+a.x,maxX=685+b.x,minY=232+a.y,maxY=790+b.y;
    const scale=Math.min(width/(maxX-minX+110),Math.max(40,height-50)/(maxY-minY+60));
    if(focus&&selected){
      const bounds={rear:[365,510,640,560],board:[400,510,460,460],display:[370,465,480,380],housing:[390,510,590,560],keys:[410,640,430,165]}[selected];
      const p=offset(selected),s=Math.min(width/(bounds[2]+60),Math.max(40,height-50)/(bounds[3]+50));return {scale:s,x:width/2-(bounds[0]+p.x)*s+panX,y:(height-35)/2-(bounds[1]+p.y)*s+panY};
    }
    return {scale,x:width/2-(minX+maxX)/2*scale+panX,y:(height-35)/2-(minY+maxY)/2*scale+panY};
  }
  function draw(time=performance.now()){
    frame=0;if(disposed||document.hidden)return;
    if(duration){const t=Math.min(1,(time-start)/duration),ease=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;progress=from+(target-from)*ease;if(t===1)duration=0;}
    const fitted=fit();
    if(viewDuration){const t=Math.min(1,(time-viewStart)/viewDuration),e=1-Math.pow(1-t,3);pose={x:viewFrom.x+(fitted.x-viewFrom.x)*e,y:viewFrom.y+(fitted.y-viewFrom.y)*e,scale:viewFrom.scale+(fitted.scale-viewFrom.scale)*e};emphasis=emphasisFrom+((focus?1:0)-emphasisFrom)*e;if(t===1)viewDuration=0;}else{pose=fitted;emphasis=focus?1:0;}
    const dpr=Math.min(devicePixelRatio,2);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
    frontContext.setTransform(dpr,0,0,dpr,0,0);frontContext.clearRect(0,0,width,height);frontContext.save();frontContext.translate(pose.x,pose.y);frontContext.scale(pose.scale,pose.scale);
    ctx.save();ctx.translate(pose.x,pose.y);ctx.scale(pose.scale,pose.scale);
    if(progress>.2){ctx.save();ctx.globalAlpha=(progress-.2)*.22;ctx.strokeStyle='#59434c';ctx.lineWidth=1/pose.scale;ctx.setLineDash([4/pose.scale,6/pose.scale]);
      for(const point of [[215,345],[564,680]]){const a=offset('rear'),b=offset('housing');ctx.beginPath();ctx.moveTo(point[0]+a.x,point[1]+a.y);ctx.lineTo(point[0]+b.x,point[1]+b.y);ctx.stroke();}ctx.restore();}
    for(const id of order){if(id==='board'&&progress===0)continue;if(focus&&id===selected)continue;const p=offset(id),paint=['housing','keys'].includes(id)?frontContext:ctx;paint.save();paint.translate(p.x,p.y);paint.shadowColor='#37212d45';paint.shadowBlur=id==='keys'?9:17;paint.shadowOffsetX=-6;paint.shadowOffsetY=12;
      paint.globalAlpha=(id==='board'?Math.min(1,progress*12):1)*(1-.84*emphasis);paint.drawImage(built.layers.get(id),crop.x,crop.y);paint.restore();}
    if(focus&&selected){const p=offset(selected);frontContext.save();frontContext.translate(p.x,p.y);frontContext.shadowColor='#37212d45';frontContext.shadowBlur=17;frontContext.shadowOffsetY=12;frontContext.drawImage(built.layers.get(selected),crop.x,crop.y);frontContext.restore();}
    if(progress<.035){ctx.save();ctx.globalAlpha=1-Math.min(1,progress/.035);ctx.clip(built.paths.outer);ctx.drawImage(housing,0,0);for(const path of built.paths.keys){ctx.save();ctx.clip(path);ctx.drawImage(keycaps,0,0);ctx.restore();}ctx.restore();}
    ctx.restore();frontContext.restore();
    const d=offset('display'),k=offset('keys');
    screen.style.transform=`translate(${pose.x+d.x*pose.scale}px,${pose.y+d.y*pose.scale}px) scale(${pose.scale}) ${projectiveMatrix(screenWidth,screenHeight,construction.screen)}`;
    screen.style.opacity=focus&&selected==='display'?'1':String(1-.84*emphasis);screen.style.zIndex=focus&&selected==='display'?'4':'2';
    legends.style.transform=`translate(${pose.x+k.x*pose.scale}px,${pose.y+k.y*pose.scale}px) scale(${pose.scale})`;
    legends.style.opacity=focus&&selected==='keys'?'1':String(1-.84*emphasis);
    canvas.dataset.separation=progress.toFixed(3);canvas.dataset.registered='source-artwork';canvas.dataset.inspect=String(focus);canvas.dataset.moving=String(!!(duration||viewDuration));if(duration||viewDuration)wake();
  }
  function resize(){const r=canvas.getBoundingClientRect();width=Math.max(1,r.width);height=Math.max(1,r.height);const dpr=Math.min(devicePixelRatio,2);canvas.width=foreground.width=Math.round(width*dpr);canvas.height=foreground.height=Math.round(height*dpr);wake();}
  const observer=new ResizeObserver(resize);observer.observe(canvas);
  function setSeparation(value,{animate=false}={}){from=progress;target=Math.max(0,Math.min(1,Number(value)||0));start=performance.now();duration=animate&&!reducedMotion.matches?1250*Math.max(.3,Math.abs(target-from)):0;if(!duration)progress=target;focus=false;viewDuration=0;panX=panY=0;wake();}
  listen(canvas,'pointerdown',event=>{if(event.button!==0)return;drag={id:event.pointerId,x:event.clientX,y:event.clientY,px:panX,py:panY,moved:false};canvas.setPointerCapture(event.pointerId);});
  listen(canvas,'pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>5)drag.moved=true;if(focus&&drag.moved){panX=Math.max(-width*.35,Math.min(width*.35,drag.px+event.clientX-drag.x));panY=Math.max(-height*.35,Math.min(height*.35,drag.py+event.clientY-drag.y));wake();}});
  function release(event){if(!drag||drag.id!==event.pointerId)return;const select=!drag.moved&&event.type==='pointerup';drag=null;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
    if(select){const r=canvas.getBoundingClientRect(),x=(event.clientX-r.left-pose.x)/pose.scale,y=(event.clientY-r.top-pose.y)/pose.scale;
      for(const id of [...order].reverse()){const p=offset(id),sx=Math.floor(x-p.x-crop.x),sy=Math.floor(y-p.y-crop.y);if(sx<0||sx>=crop.width||sy<0||sy>=crop.height)continue;const pixel=built.layers.get(id).getContext('2d').getImageData(sx,sy,1,1).data[3];if(pixel>40){onSelect?.(id);break;}}}}
  for(const event of ['pointerup','pointercancel','lostpointercapture'])listen(canvas,event,release);
  listen(document,'visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else wake();});
  const motion=()=>{if(reducedMotion.matches){duration=0;viewDuration=0;progress=target;wake();}};reducedMotion.addEventListener('change',motion);resize();
  function changeView(){viewFrom={...pose};emphasisFrom=emphasis;viewStart=performance.now();viewDuration=reducedMotion.matches?0:460;panX=panY=0;wake();}
  return {setSeparation,resetView(){focus=false;changeView();},select(id,{inspect=false}={}){selected=id;focus=inspect;changeView();},
    exportLayers(){return Object.fromEntries([...built.layers].map(([id,c])=>[id,{png:c.toDataURL('image/png'),origin:{x:crop.x,y:crop.y}}]));},
    dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);observer.disconnect();listeners.forEach(remove=>remove());reducedMotion.removeEventListener('change',motion);screen.remove();legends.remove();foreground.remove();built.dispose();}};
}
