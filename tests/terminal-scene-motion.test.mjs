import {test} from 'node:test';
import assert from 'node:assert/strict';
import {advanceSpring,partProgress,partTranslation,handoffBlend,boundInspection,fitExplosion,revealWeight,revealComposition,scatterSlot,revealFlight,ambientTumble} from '../assets/terminal-scene-motion.mjs';
import {roomMask} from '../assets/terminal-room.mjs';

test('suspended parts start gently and maintain independent slow off-axis tumbling without a loop reset',()=>{
  const ids=['rear','board','display','housing','keys'];
  for(const id of ids){
    assert.deepEqual(ambientTumble(id,0),{yaw:0,pitch:0,roll:0});
    const early=ambientTumble(id,.001);assert.ok(Object.values(early).every(v=>Math.abs(v)<1e-9),'There must be no angular impulse at the landing');
    for(let time=0;time<=600;time+=.25){
      const a=ambientTumble(id,time),b=ambientTumble(id,time+.01);
      assert.ok(Object.values(a).every(Number.isFinite));
      const speed=Math.hypot(...Object.keys(a).map(axis=>(b[axis]-a[axis])/.01));
      assert.ok(speed<.14,'The ambient motion must remain controlled, including long sessions');
    }
    const later=ambientTumble(id,30);assert.ok(Object.values(later).every(v=>Math.abs(v)>.08),'Every part must tumble across all three axes');
    assert.ok(Math.hypot(...Object.values(ambientTumble(id,.35)))>.007,'Angular momentum must become visible during the release, without a landing pause');
    assert.ok(Math.hypot(...Object.values(ambientTumble(id,6)))>.20,'The tumble must be clearly visible within six seconds');
    assert.notDeepEqual(ambientTumble(id,60),ambientTumble(id,120),'The motion must not rewind at a repeated animation boundary');
  }
  assert.equal(new Set(ids.map(id=>JSON.stringify(ambientTumble(id,20)))).size,5);
  assert.throws(()=>ambientTumble('other',1));
});
test('the resting composition uses distinct positions across the scene',()=>{
  for(const mobile of [false,true]){const width=mobile?393:1440,height=mobile?852:900,contentTop=mobile?290:0,slots=['rear','board','display','housing','keys'].map(id=>scatterSlot(id,{width,height,contentTop,mobile}));
    assert.equal(new Set(slots.map(({x,y})=>x+','+y)).size,5);
    assert.ok(Math.max(...slots.map(s=>s.x))-Math.min(...slots.map(s=>s.x))>=width*.5);
    assert.ok(Math.max(...slots.map(s=>s.y))-Math.min(...slots.map(s=>s.y))>=(height-contentTop)*.65);
  }
});
test('the reveal clears the joints and separates monotonically without a rebound',()=>{
  for(const id of ['rear','board','display','housing','keys']){
    assert.equal(revealWeight(id,0),0);assert.equal(revealWeight(id,.3),0);assert.equal(revealWeight(id,1),1);
    const samples=Array.from({length:1001},(_,i)=>revealWeight(id,i/1000));
    assert.ok(samples.every((v,i)=>v>=0&&v<=1.000000001&&(!i||v>=samples[i-1]-1e-10)));
    assert.ok(Math.abs(revealWeight(id,.9999)-1)<.00001);
    for(const mobile of [false,true])assert.ok(Object.values(revealComposition(id,mobile)).every(Number.isFinite));
  }
  assert.throws(()=>revealWeight('other',.5));
});
test('the scene starts and finishes at the exact homepage pose',()=>{
  for(const part of ['rear','board','display','housing','keys']){assert.equal(partProgress(part,0),0);assert.equal(partProgress(part,1),1);for(const mobile of [false,true])assert.deepEqual(partTranslation(part,0,mobile),{x:0,y:0});}
  assert.deepEqual(partTranslation('rear',1,true),{x:0,y:0});
  assert.deepEqual(partTranslation('display',1,false),{x:0,y:0});
});
test('the opening toss curves outward with bounded off-axis tumbling and zero endpoint velocity',()=>{
  for(const id of ['rear','board','display','housing','keys']){
    assert.deepEqual(revealFlight(id,0),{weight:0,yaw:0,pitch:0,roll:0,x:0,y:0});
    assert.equal(revealFlight(id,.3).weight,0);
    const end=revealFlight(id,1);assert.deepEqual(end,{weight:1,yaw:0,pitch:0,roll:0,x:0,y:0});
    const samples=Array.from({length:1001},(_,i)=>revealFlight(id,i/1000));
    for(const axis of ['yaw','pitch','roll'])assert.ok(samples.some(s=>Math.abs(s[axis])>.04));
    assert.ok(samples.every(s=>Math.max(Math.abs(s.yaw),Math.abs(s.pitch),Math.abs(s.roll))<.5),'The release must not whip the parts through large temporary rotations');
    assert.ok(samples.some(s=>Math.abs(s.x)>5&&s.y< -5),'The flight needs a shallow curved trajectory');
    assert.ok(samples.every(s=>Object.values(s).every(Number.isFinite)));
    assert.ok(samples.every((s,i)=>s.weight<=1.000000001&&(!i||s.weight>=samples[i-1].weight-1e-10)));
    for(const [key,value]of Object.entries(revealFlight(id,.99999)))assert.ok(Math.abs(value-end[key])<.0001,'Flight velocity must vanish at the endpoint');
  }
  assert.throws(()=>revealFlight('other',.5));
});
test('spring interruption preserves position and velocity, and settles at 30,60,120 Hz',()=>{
  for(const hz of [30,60,120]){
    let state={position:0,velocity:0};
    for(let i=0;i<hz/4;i++)state=advanceSpring(state,1,1/hz);
    const before={...state};assert.deepEqual(advanceSpring(state,0,0),before);
    const reversed=advanceSpring(state,0,1/hz);assert.ok(Math.abs(reversed.position-state.position)<.15);
    for(let i=0;i<hz*2;i++)state=advanceSpring(state,0,1/hz);
    assert.equal(state.position,0);assert.equal(state.velocity,0);
  }
});
test('the slower closing spring docks without overshooting or reversing',()=>{
  let slow={position:1,velocity:0},normal={...slow},previous=1;
  for(let i=0;i<180;i++){slow=advanceSpring(slow,0,1/60,10);normal=advanceSpring(normal,0,1/60);assert.ok(slow.position>=0&&slow.position<=previous);previous=slow.position;if(i===20)assert.ok(slow.position>normal.position);}
  assert.deepEqual(slow,{position:0,velocity:0});
});
test('the concealed room field excludes the existing background and cast shadow',()=>{
  assert.equal(roomMask(350,500,false),1);assert.equal(roomMask(200,550,true),1);
  for(const point of [[0,0],[1200,100],[900,300]])assert.equal(roomMask(...point,false),0);
  assert.equal(roomMask(200,80,true),0);
  assert.equal(roomMask(950,820,false),0);
});
test('closing never fades the room through overlapping translucent product surfaces',()=>{
  assert.deepEqual(handoffBlend(.003),{visible:false,reference:1});
  assert.deepEqual(handoffBlend(0),{visible:false,reference:1});
  assert.deepEqual(handoffBlend(.006),{visible:true,reference:1});
  assert.equal(handoffBlend(.05).visible,true);
  assert.ok(handoffBlend(.05).reference>0&&handoffBlend(.05).reference<1);
  assert.deepEqual(handoffBlend(1),{visible:true,reference:0});
});
test('inspection dragging remains finite without an artificial travel cap',()=>{
  assert.deepEqual(boundInspection({x:300,y:-500},1000,600),{x:300,y:-500});
  assert.deepEqual(boundInspection({x:1200,y:-900},400,800),{x:1200,y:-900});
  assert.deepEqual(boundInspection({x:NaN,y:Infinity},400,800),{x:0,y:0});
  assert.deepEqual(boundInspection({x:0,y:0},400,800),{x:0,y:0});
});
test('separation contracts to the available room without changing the homepage camera',()=>{
  assert.equal(fitExplosion({mobile:true,x:0,y:0,scale:1,width:416,height:932}),1);
  const fit=fitExplosion({mobile:true,x:0,y:0,scale:.7,width:320,height:568});
  assert.ok(fit>0&&fit<1);
  assert.ok(.7*(763+85*fit)<=560.001);
});
