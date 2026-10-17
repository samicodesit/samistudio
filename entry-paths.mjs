export const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
export const mix=(a,b,t)=>a+(b-a)*t;
export const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
export const out=t=>1-Math.pow(1-clamp(t),4);
export const blend=(a,b,t)=>a.map((p,i)=>p.map((v,j)=>mix(v,b[i][j],t)));
export const rect=(l,t,r,b)=>[[l,t],[r,t],[r,b],[l,b]];
export const polygon=q=>'polygon('+q.map(p=>p.map(v=>v.toFixed(3)+'px').join(' ')).join(',')+')';
export function parseAperture(value,w,h) {
 const values=value.match(/[-\d.]+/g)?.map(Number);
 if(values?.length!==8)throw Error('Missing screen aperture');
 return Array.from({length:4},(_,i)=>[values[i*2]*w/100,values[i*2+1]*h/100]);
}
export const center=q=>[0,1].map(axis=>q.reduce((sum,p)=>sum+p[axis],0)/4);
const contains=(q,p)=>q.every((a,i)=>{const b=q[(i+1)%4];return (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])>=0;});
export function portalCamera(source,w,h,t) {
 const c=center(source),dx=w/2-c[0],dy=h/2-c[1];
 let zoom=1;
 while(zoom<40) {
  const q=source.map(([x,y])=>[w/2+(x-c[0])*zoom,h/2+(y-c[1])*zoom]);
  if(rect(-8,-8,w+8,h+8).every(p=>contains(q,p)))break;
  zoom*=1.08;
 }
 const flight=smooth((t-.08)/.82),z=mix(1,zoom,flight),tx=dx*flight,ty=dy*flight;
 return {quad:source.map(([x,y])=>[c[0]+(x-c[0])*z+tx,c[1]+(y-c[1])*z+ty]),transform:'translate('+tx+'px,'+ty+'px) scale('+z+')',origin:c.map(x=>x+'px').join(' ')};
}
export function signalAperture(source,w,h,t) {
 const end=rect(-3,-3,w+3,h+3);
 if(t<.18)return source;
 return blend(source,end,out((t-.18)/.16));
}
