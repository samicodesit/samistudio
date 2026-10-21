import {test} from 'node:test';
import assert from 'node:assert/strict';
import {construction,layerPose,frontPlanePoint,inverseFrontPlane} from '../assets/terminal-construction.mjs';
test('the exterior is registered to the actual homepage artwork',()=>{
  assert.equal(construction.housing,'./terminal-housing.webp');
  assert.equal(construction.keycaps,'./terminal-keycaps.webp');
  assert.equal(construction.width,1686);assert.equal(construction.height,933);
  assert.equal(construction.keyPaths.length,3);
});
test('all three switch stems register behind their original photographed key faces',()=>{
  for(const [i,point]of construction.keyMounts.entries()){
    const local=inverseFrontPlane(...point),restored=frontPlanePoint(...local),key=construction.keyPaths[i];
    assert.ok(Math.hypot(point[0]-restored[0],point[1]-restored[1])<1e-8);
    assert.ok(point[0]>key.x&&point[0]<key.x+key.w&&point[1]>key.y&&point[1]<key.y+key.h);
    assert.ok(local[0]>7&&local[0]<93&&local[1]>7&&local[1]<93);
  }
});
test('the phone layout retains a common separation axis and exact assembled registration',()=>{
  const axis={x:.34,y:.85};
  for(const id of ['rear','board','display','housing','keys']){
    assert.deepEqual(layerPose(id,0,axis),{x:0,y:0});
    const p=layerPose(id,1,axis);assert.ok(Math.abs(p.y*.34-p.x*.85)<1e-8);
  }
});
test('assembled layers register exactly and separation shares one mounting vector',()=>{
  for(const id of ['rear','board','display','housing','keys']){
    assert.deepEqual(layerPose(id,0),{x:0,y:0});
    const p=layerPose(id,1);assert.ok(Math.abs(p.y-p.x*.23)<1e-9);
  }
});
