// Inpaint the concealed footprint using the actual fitted homepage photograph.
// Boundary colours come from the room immediately outside the old enclosure.
export function cleanRoomPatch({background,patch,variant,home,page=document}){
 const w=background.width,h=background.height,dpr=w/page.querySelector('.experience').getBoundingClientRect().width,scale=home.scale*dpr;
 const source=background.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h),mask=page.createElement('canvas');mask.width=w;mask.height=h;
 const m=mask.getContext('2d',{willReadFrequently:true});m.setTransform(scale,0,0,scale,home.x*dpr,home.y*dpr);m.fillStyle='#fff';m.strokeStyle='#fff';m.lineWidth=38;m.lineJoin='round';const path=new Path2D(variant.outer);m.fill(path);m.stroke(path);
 // The detached pieces expose the old contact shadow too. Repair its footprint
 // and feather into the photograph instead of leaving an empty-device outline.
 m.beginPath();variant.mobile?m.ellipse(210,786,230,53,0,0,Math.PI*2):m.ellipse(395,776,330,72,-.07,0,Math.PI*2);m.fill();
 const soft=page.createElement('canvas');soft.width=w;soft.height=h;const sc=soft.getContext('2d');sc.filter=`blur(${7*scale}px)`;sc.drawImage(mask,0,0);m.setTransform(1,0,0,1,0,0);m.clearRect(0,0,w,h);m.drawImage(soft,0,0);soft.width=soft.height=1;
 const alpha=m.getImageData(0,0,w,h).data,step=Math.max(3,Math.round(6*dpr)),gw=Math.ceil(w/step)+1,gh=Math.ceil(h/step)+1,field=new Float32Array(gw*gh*3),inside=new Uint8Array(gw*gh);
 const sample=(x,y,c)=>source.data[(Math.max(0,Math.min(h-1,Math.round(y)))*w+Math.max(0,Math.min(w-1,Math.round(x))))*4+c];
 for(let y=0;y<gh;y++)for(let x=0;x<gw;x++){const px=Math.min(w-1,x*step),py=Math.min(h-1,y*step),i=y*gw+x;inside[i]=alpha[(py*w+px)*4+3]>0?1:0;for(let c=0;c<3;c++)field[i*3+c]=inside[i]?sample(w-1,py,c):sample(px,py,c);}
 for(let n=0;n<600;n++)for(let y=1;y<gh-1;y++)for(let x=1;x<gw-1;x++){const i=y*gw+x;if(inside[i])for(let c=0;c<3;c++)field[i*3+c]=(field[(i-1)*3+c]+field[(i+1)*3+c]+field[(i-gw)*3+c]+field[(i+gw)*3+c])*.25;}
 // A high-pass tile supplies the photograph's real fine grain, without copying
 // its object, lighting shapes or low-frequency colour into the repaired area.
 const blurred=page.createElement('canvas');blurred.width=w;blurred.height=h;const bc=blurred.getContext('2d',{willReadFrequently:true});bc.filter=`blur(${6*dpr}px)`;bc.drawImage(background,0,0);const low=bc.getImageData(0,0,w,h).data;
 const result=new ImageData(w,h),x0=Math.round(w*(variant.mobile?.1:.62)),y0=Math.round(h*(variant.mobile?.1:.68)),tw=Math.max(1,Math.round(w*.12)),th=Math.max(1,Math.round(h*(variant.mobile?.1:.15)));
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const j=(y*w+x)*4;if(!alpha[j+3])continue;const gx=x/step,gy=y/step,ix=Math.floor(gx),iy=Math.floor(gy),fx=gx-ix,fy=gy-iy,i=iy*gw+ix,tile=((y0+y%th)*w+x0+x%tw)*4;
  for(let c=0;c<3;c++){const a=field[i*3+c]*(1-fx)+field[(i+1)*3+c]*fx,b=field[(i+gw)*3+c]*(1-fx)+field[(i+gw+1)*3+c]*fx;result.data[j+c]=a*(1-fy)+b*fy+(source.data[tile+c]-low[tile+c])*.8;}result.data[j+3]=alpha[j+3];}
 patch.width=w;patch.height=h;patch.getContext('2d').putImageData(result,0,0);mask.width=mask.height=blurred.width=blurred.height=1;
}
