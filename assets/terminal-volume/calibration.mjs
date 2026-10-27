export function calibratedFrame({mobile=false}={}){
  const a=mobile?3.65:4.38,b=mobile?0:-.35,c=mobile?0:.9,d=mobile?3.85:4.55;
  const origin=mobile?[26,376]:[130,280],width=mobile?416:1686,height=mobile?932:933;
  const rr=a*a+c*c,uu=b*b+d*d,dot=-a*b-c*d;
  const scale2=(rr+uu+Math.hypot(rr-uu,2*dot))/2,scale=Math.sqrt(scale2);
  const rz=-Math.sqrt(Math.max(0,scale2-rr)),uz=Math.abs(rz)>1e-9?-dot/rz:0;
  const right=[a/scale,c/scale,rz/scale],up=[-b/scale,-d/scale,uz/scale];
  const normal=[right[1]*up[2]-right[2]*up[1],right[2]*up[0]-right[0]*up[2],right[0]*up[1]-right[1]*up[0]];
  const det=a*d-b*c;
  const project=([x,y,z])=>[origin[0]+a*x+c*y+rz*z,origin[1]+b*x+d*y-uz*z];
  const unproject=([px,py],z=0)=>{const x=px-origin[0]-rz*z,y=py-origin[1]+uz*z;return [(d*x-c*y)/det,(-b*x+a*y)/det,z];};
  const offset=(x,y)=>right.map((v,i)=>v*x/scale-up[i]*y/scale);
  return {a,b,c,d,origin,width,height,scale,right,up,normal,project,unproject,offset};
}
