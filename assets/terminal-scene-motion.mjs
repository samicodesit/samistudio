const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
export function handoffBlend(value){
  const t=clamp(value),mix=clamp((t-.006)/.08);
  return {visible:t>=.006,reference:1-mix*mix*(3-2*mix)};
}
export function boundInspection(offset,width,height){
  const finite=v=>Number.isFinite(v)?v:0;
  return {x:Math.max(-width*.22,Math.min(width*.22,finite(offset.x))),y:Math.max(-height*.22,Math.min(height*.22,finite(offset.y)))};
}
export const partExtents=Object.freeze({
  mobile:{rear:[13,365,408,767],board:[51,403,366,735],display:[40,387,376,685],housing:[25,366,405,763],keys:[51,630,359,724]},
  desktop:{rear:[50,237,687,785],board:[166,279,622,701],display:[131,269,628,643],housing:[95,237,687,785],keys:[200,560,619,720]},
});
export function fitExplosion({mobile,x,y,scale,width,height}){
  let fit=1;const extents=partExtents[mobile?'mobile':'desktop'];
  for(const [id,[left,top,right,bottom]]of Object.entries(extents)){
    const pose=partTranslation(id,1,mobile),dx=pose.x*scale,dy=pose.y*scale;
    if(dx>0)fit=Math.min(fit,(width-8-x-right*scale)/dx);
    if(dx<0)fit=Math.min(fit,(x+left*scale-8)/-dx);
    if(dy>0)fit=Math.min(fit,(height-8-y-bottom*scale)/dy);
    if(dy<0)fit=Math.min(fit,(y+top*scale-8)/-dy);
  }
  return clamp(fit);
}
export function advanceSpring(state,target,dt){
  if(!(dt>0))return {...state};
  const t=Math.min(dt,.05),omega=12,offset=state.position-target,c=state.velocity+omega*offset,e=Math.exp(-omega*t);
  const position=target+(offset+c*t)*e,velocity=(state.velocity-omega*c*t)*e;
  return Math.abs(position-target)<.0001&&Math.abs(velocity)<.001?{position:target,velocity:0}:{position,velocity};
}
export function partProgress(id,value){
  const delay={keys:0,housing:.035,display:.075,board:.11,rear:.06}[id]??0;
  const t=clamp((value-delay)/(1-delay));return t*t*(3-2*t);
}
export function partTranslation(id,value,mobile=false){
  const distances=mobile?{rear:0,board:25,display:50,housing:85,keys:130}:{rear:-65,board:-32,display:0,housing:55,keys:110};
  if(!(id in distances))throw Error('Unknown assembly: '+id);
  const distance=distances[id]*partProgress(id,value);
  return {x:distance&&!mobile?distance:0,y:distance?(mobile?1:.23)*distance:0};
}
