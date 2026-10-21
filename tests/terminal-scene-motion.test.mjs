import {test} from 'node:test';
import assert from 'node:assert/strict';
import {advanceSpring,partProgress,partTranslation,handoffBlend,boundInspection,fitExplosion} from '../assets/terminal-scene-motion.mjs';
import {roomMask} from '../assets/terminal-room.mjs';
test('the scene starts and finishes at the exact homepage pose',()=>{
  for(const part of ['rear','board','display','housing','keys']){assert.equal(partProgress(part,0),0);assert.equal(partProgress(part,1),1);for(const mobile of [false,true])assert.deepEqual(partTranslation(part,0,mobile),{x:0,y:0});}
  assert.deepEqual(partTranslation('rear',1,true),{x:0,y:0});
  assert.deepEqual(partTranslation('display',1,false),{x:0,y:0});
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
test('inspection dragging is finite, bounded, and returns to the registered pose',()=>{
  assert.deepEqual(boundInspection({x:300,y:-500},1000,600),{x:220,y:-132});
  assert.deepEqual(boundInspection({x:NaN,y:Infinity},400,800),{x:0,y:0});
  assert.deepEqual(boundInspection({x:0,y:0},400,800),{x:0,y:0});
});
test('separation contracts to the available room without changing the homepage camera',()=>{
  assert.equal(fitExplosion({mobile:true,x:0,y:0,scale:1,width:416,height:932}),1);
  const fit=fitExplosion({mobile:true,x:0,y:0,scale:.7,width:320,height:568});
  assert.ok(fit>0&&fit<1);
  assert.ok(.7*(763+85*fit)<=560.001);
});
