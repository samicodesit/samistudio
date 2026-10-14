import assert from 'node:assert/strict';
import { test } from 'node:test';
import { galleryOrder, settledSlot } from '../assets/gallery-navigation.mjs';
const ids = ['doodle','autolister','cryptik'];

test('the active project always has the previous and next scene adjacent, including wrap', () => {
  assert.deepEqual(galleryOrder(ids,'doodle'), ['cryptik','doodle','autolister']);
  assert.deepEqual(galleryOrder(ids,'autolister'), ['doodle','autolister','cryptik']);
  assert.deepEqual(galleryOrder(ids,'cryptik'), ['autolister','cryptik','doodle']);
});

test('a partial native scroll never commits a project or recenters the track', () => {
  for (const offset of [12,200,360,500,675,701,1000]) assert.equal(settledSlot(offset,700), null);
  assert.equal(settledSlot(0,700),0);
  assert.equal(settledSlot(700,700),1);
  assert.equal(settledSlot(1400,700),2);
  assert.equal(settledSlot(1399.7,700),2);
});

test('scroll settlement handles viewport changes and rejects invalid dimensions', () => {
  assert.equal(settledSlot(676,676),1);
  assert.equal(settledSlot(780,780),1);
  assert.equal(settledSlot(780,676),null);
  assert.equal(settledSlot(0,0),null);
  assert.equal(settledSlot(NaN,676),null);
  assert.equal(settledSlot(3000,676),null);
});
