import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gallerySequence, centerSlot, settledSlot } from '../assets/gallery-navigation.mjs';
const ids=['doodle','autolister','cryptik'];

test('three fixed cycles provide real neighboring scenes on both sides',()=>{
  const sequence=gallerySequence(ids);
  assert.deepEqual(sequence,[...ids,...ids,...ids]);
  assert.deepEqual(ids,['doodle','autolister','cryptik']);
  for(let i=3;i<6;i++) {
    assert.equal(sequence[i-1],ids[(i+2)%3]);
    assert.equal(sequence[i+1],ids[(i+1)%3]);
  }
});

test('boundary copies map to the identical project in the middle cycle',()=>{
  const sequence=gallerySequence(ids);
  for(let i=0;i<sequence.length;i++) {
    const target=centerSlot(i,ids.length);
    assert.ok(target>=3&&target<6);
    assert.equal(sequence[i],sequence[target]);
    if(i>=3&&i<6) assert.equal(target,i);
  }
});

test('partial movement never commits or relocates a scene',()=>{
  for(const offset of [12,200,360,500,675,701,1000]) assert.equal(settledSlot(offset,700,9),null);
  for(let i=0;i<9;i++) assert.equal(settledSlot(i*700,700,9),i);
  assert.equal(settledSlot(5599.7,700,9),8);
  assert.equal(settledSlot(6300,700,9),null);
  assert.equal(settledSlot(NaN,700,9),null);
  assert.equal(settledSlot(0,0,9),null);
});
