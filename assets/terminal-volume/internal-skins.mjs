// Copper routing and silkscreen are independent of raised components. Actual
// solids supply the component faces, contacts and shadows without duplication.
export function bareBoard({source,variant,frame,page=document}){
 const c=page.createElement('canvas');c.width=source.width;c.height=source.height;const ctx=c.getContext('2d'),image=ctx.createImageData(c.width,c.height);
 for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4;let v=Math.imul(x+y*c.width+971,1597334677);v^=v>>>16;v=Math.imul(v,2246822519);v^=v>>>13;const n=(v>>>24)/127.5-1;image.data[i]=28+n;image.data[i+1]=65+n;image.data[i+2]=47+n;image.data[i+3]=255;}ctx.putImageData(image,0,0);
 const matrix=[frame.a,frame.b,frame.c,frame.d,...frame.project([0,0,1])];ctx.save();ctx.transform(...matrix);ctx.lineWidth=.18;ctx.strokeStyle='#9e9864';ctx.globalAlpha=.8;
 const trace=points=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();};
 for(let i=0;i<13;i++){const x=40+i*1.3;trace([[39.5+i*1.5,51],[39.5+i*1.5,54+i*.45],[x,61+i*.22],[x,68.9]]);}
 const mounts=variant.keyMounts.map(p=>frame.unproject(p,-2));
 mounts.forEach(([x,y],i)=>{const sx=[36,49.5,63][i];trace([[sx,45],[sx,56+i*2],[x-5,64+i*2],[x-5,y]]);trace([[x+5,y],[x+5,89],[72,89],[72,43],[63,43]]);});
 for(let i=0;i<12;i++){const x=15+i%6*12,y=i<6?17:59;trace([[x,y],[x,21+(i%3)*2],[34,25+i*.4]]);}
 for(let i=0;i<7;i++){trace([[15,29+i*1.1],[29-i*.8,29+i*1.1],[36,33+i*1.1]]);trace([[63,32+i*1.2],[68+i*.7,32+i*1.2],[80,25+i*1.2]]);}
 ctx.globalAlpha=1;for(const [x,y]of [...mounts.flatMap(([x,y])=>[[x-5,y],[x+5,y]]),[29,28],[69,35],[33,55],[72,58],[25,22],[80,22]]){ctx.fillStyle='#aa9f68';ctx.beginPath();ctx.arc(x,y,.65,0,Math.PI*2);ctx.fill();ctx.fillStyle='#152c22';ctx.beginPath();ctx.arc(x,y,.27,0,Math.PI*2);ctx.fill();}
 ctx.strokeStyle='#c9cfb0';ctx.lineWidth=.16;for(const [x,y,w,h]of [[37,30,25,20],[14,23,12,11],[67,39,10,10],[73,53,10,11],...mounts.map(([x,y])=>[x-8.6,y-7.6,17.2,15.2])]){ctx.beginPath();ctx.roundRect(x,y,w,h,1);ctx.stroke();}
 ctx.fillStyle='#bcc5a9';ctx.font='1.7px Arial';ctx.fillText('SAMI STUDIO / INPUT',14,55);ctx.fillText('REV. 03',74,90);ctx.restore();return c;
}

// Hidden interiors can be rendered from their real construction. Their baked
// rest frames make the initial reveal deterministic and avoid a material swap.
// The photographed enclosure outside its front-face footprint stays untouched.
export function bakeInteriors({model,renderer,scene,camera,canvas,photoRoot,variant,home,page=document}){
 const saved=[...model.parts].map(([id,part])=>({id,part,position:part.position.clone(),quaternion:part.quaternion.clone(),scale:part.scale.clone(),visible:part.visible}));
 for(const id of ['rear','board']){
  for(const {id:key,part}of saved){part.visible=key===id;if(key===id){part.position.copy(part.userData.pivot);part.quaternion.identity();part.scale.setScalar(1);}}
  model.root.updateMatrixWorld(true);scene.updateMatrixWorld(true);renderer.render(scene,camera);
  const art=photoRoot.querySelector(`[data-part="${id}"] .te-art`),ctx=art.getContext('2d');ctx.save();
  if(id==='rear'){const dpr=art.width/page.querySelector('.experience').getBoundingClientRect().width;ctx.setTransform(home.scale*dpr,0,0,home.scale*dpr,home.x*dpr,home.y*dpr);ctx.clip(new Path2D(variant.face));ctx.setTransform(1,0,0,1,0,0);}
  ctx.clearRect(0,0,art.width,art.height);ctx.drawImage(canvas,0,0,art.width,art.height);ctx.restore();
 }
 for(const state of saved){state.part.position.copy(state.position);state.part.quaternion.copy(state.quaternion);state.part.scale.copy(state.scale);state.part.visible=state.visible;}model.root.updateMatrixWorld(true);scene.updateMatrixWorld(true);
}
