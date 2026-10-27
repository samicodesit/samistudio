const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
const revealSettings={
  rear:{delay:.09,desktop:[0,0,-22,12,-12],mobile:[0,0,-16,12,-12]},
  board:{delay:.055,desktop:[0,0,18,-16,13],mobile:[0,0,12,-14,10]},
  display:{delay:.025,desktop:[0,0,-5,4,-8],mobile:[0,0,0,0,-6]},
  housing:{delay:0,desktop:[0,0,-28,18,12],mobile:[0,0,-24,14,10]},
  keys:{delay:.035,desktop:[0,0,16,-14,-12],mobile:[0,0,12,-16,-9]},
};
// A deterministic, monotonic fan with zero endpoint velocity.
// The native separation starts immediately. Rotation waits for joint clearance.
export function revealWeight(id,value){
  const settings=revealSettings[id];if(!settings)throw Error('Unknown assembly: '+id);
  const t=clamp((value-.3-settings.delay)/(.7-settings.delay)),t2=t*t,t3=t2*t;
  return t3*(10-15*t+6*t2);
}
export function revealComposition(id,mobile=false){
  const settings=revealSettings[id];if(!settings)throw Error('Unknown assembly: '+id);
  const [x,y,yaw,pitch,roll]=settings[mobile?'mobile':'desktop'];
  return {x,y,yaw:yaw*Math.PI/180,pitch:pitch*Math.PI/180,roll:roll*Math.PI/180};
}
// Slow angular momentum with a soft start and slight precession. Time never
// wraps, so a long visit cannot jump back to an animation's first frame.
export function ambientTumble(id,seconds){
  const settings={rear:[.018,.012,-.009,0],board:[-.019,.026,.011,1.3],display:[.011,-.013,.008,2.6],housing:[-.014,.017,-.010,3.9],keys:[.023,-.017,.019,5.2]}[id];
  if(!settings)throw Error('Unknown assembly: '+id);
  const time=Math.max(0,Number.isFinite(seconds)?seconds:0),ramp=.35,u=Math.min(1,time/ramp),t=time<ramp?ramp*(u**3-.5*u**4):time-ramp/2;
  if(time===0)return {yaw:0,pitch:0,roll:0};
  const [yaw,pitch,roll,phase]=settings;
  const axis=(rate,frequency,offset)=>rate*2.8*(t+.24/frequency*(Math.sin(t*frequency+offset)-Math.sin(offset)));
  return {yaw:axis(yaw,.13,phase),pitch:axis(pitch,.11,phase+.8),roll:axis(roll,.09,phase+1.7)};
}
// A shallow curved release. Its transient torque stays small enough for the
// continuous angular momentum to read throughout separation and suspension.
export function revealFlight(id,value){
  const settings=revealSettings[id];if(!settings)throw Error('Unknown assembly: '+id);
  const t=clamp((value-.3-settings.delay)/(.7-settings.delay)),t2=t*t,t3=t2*t;
  if(t===0||t===1)return {weight:t,yaw:0,pitch:0,roll:0,x:0,y:0};
  const weight=t3*(10-15*t+6*t2),envelope=16*t2*(1-t)*(1-t);
  const [yaw,pitch,roll,side,lift]={rear:[24,-32,9,-24,18],board:[-18,26,-12,22,24],display:[6,-10,18,-18,14],housing:[-26,16,-12,26,20],keys:[18,-30,24,-22,28]}[id];
  const rad=Math.PI/180,sweep=Math.PI*t*.85;
  return {weight,yaw:yaw*envelope*Math.cos(Math.PI*t*.75)*rad,pitch:pitch*envelope*Math.sin(Math.PI*t*1.2+.35)*rad,roll:roll*envelope*Math.sin(Math.PI*t*1.4-.4)*rad,
    x:side*envelope*Math.cos(sweep),y:envelope*(-lift+side*.4*Math.sin(sweep))};
}
export function scatterSlot(id,{width,height,contentTop=0,mobile=false}){
  const slots=mobile?{
    rear:[.23,.24,.43,.34],board:[.75,.25,.38,.32],display:[.25,.64,.49,.27],housing:[.75,.70,.43,.38],keys:[.32,.94,.53,.15],
  }:{
    rear:[.155,.265,.29,.37],board:[.425,.175,.225,.30],display:[.25,.69,.355,.40],housing:[.79,.16,.24,.29],keys:[.75,.84,.34,.20],
  };
  const slot=slots[id];if(!slot)throw Error('Unknown assembly: '+id);
  const available=height-contentTop;
  return {x:width*slot[0],y:contentTop+available*slot[1],width:width*slot[2],height:available*slot[3]};
}
export function handoffBlend(value){
  const t=clamp(value),mix=clamp((t-.006)/.115),m2=mix*mix,m3=m2*mix;
  return {visible:t>=.006,reference:1-m3*(10-15*mix+6*m2)};
}
export function boundInspection(offset,width,height){
  const finite=v=>Number.isFinite(v)?v:0;
  return {x:finite(offset.x),y:finite(offset.y)};
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
export function advanceSpring(state,target,dt,omega=12){
  if(!(dt>0))return {...state};
  const t=Math.min(dt,.05),offset=state.position-target,c=state.velocity+omega*offset,e=Math.exp(-omega*t);
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
