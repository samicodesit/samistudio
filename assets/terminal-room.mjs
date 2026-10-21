const smooth=v=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
export function roomMask(x,y,mobile=false,wide=false){
  if(wide){x=(x-582)/.746;y=(y-22)/.746;}
  const rect=mobile?[12,360,402,777,34]:[35,230,690,795,55];
  const [l,t,r,b,radius]=rect,cx=(l+r)/2,cy=(t+b)/2;
  const qx=Math.abs(x-cx)-(r-l)/2+radius,qy=Math.abs(y-cy)-(b-t)/2+radius;
  const distance=Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-radius;
  const object=1-smooth((distance+8)/30);
  return object;
}
// Reconstruct only the room concealed by the device, keeping all other pixels.
// The low-frequency field follows sampled room boundaries; fine grain is procedural.
export function createCleanTerminalPlate(image,{mobile=false,wide=false,page=document}={}){
  const canvas=page.createElement('canvas');canvas.width=image.naturalWidth||image.width;canvas.height=image.naturalHeight||image.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
  const source=ctx.getImageData(0,0,canvas.width,canvas.height),w=canvas.width,h=canvas.height;
  const step=mobile?8:12,gw=Math.ceil(w/step)+1,gh=Math.ceil(h/step)+1,field=new Float32Array(gw*gh*3),mask=new Uint8Array(gw*gh);
  const sample=(x,y,c)=>source.data[(Math.min(h-1,Math.max(0,Math.round(y)))*w+Math.min(w-1,Math.max(0,Math.round(x))))*4+c];
  for(let y=0;y<gh;y++)for(let x=0;x<gw;x++){
    const px=Math.min(w-1,x*step),py=Math.min(h-1,y*step),i=y*gw+x;
    mask[i]=roomMask(px,py,mobile,wide)>.001?1:0;
    for(let c=0;c<3;c++)field[i*3+c]=mask[i]?sample(0,py,c)*(1-px/w)+sample(w-1,py,c)*px/w:sample(px,py,c);
  }
  for(let iteration=0;iteration<340;iteration++)for(let y=1;y<gh-1;y++)for(let x=1;x<gw-1;x++){
    const i=y*gw+x;if(!mask[i])continue;
    for(let c=0;c<3;c++)field[i*3+c]=(field[(i-1)*3+c]+field[(i+1)*3+c]+field[(i-gw)*3+c]+field[(i+gw)*3+c])*.25;
  }
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const alpha=roomMask(x,y,mobile,wide);if(!alpha)continue;
    const gx=x/step,gy=y/step,ix=Math.floor(gx),iy=Math.floor(gy),fx=gx-ix,fy=gy-iy,i=iy*gw+ix;
    const grain=(((x*73+y*151+(x*y)%137)%101)/100-.5)*2.1;
    for(let c=0;c<3;c++){
      const a=field[i*3+c]*(1-fx)+field[(i+1)*3+c]*fx,b=field[(i+gw)*3+c]*(1-fx)+field[(i+gw+1)*3+c]*fx,index=(y*w+x)*4+c;
      source.data[index]=source.data[index]*(1-alpha)+(a*(1-fy)+b*fy+grain)*alpha;
    }
  }
  ctx.putImageData(source,0,0);return canvas;
}
