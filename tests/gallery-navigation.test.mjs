import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWheelGesture, swipeDirection, adjacentProject } from '../assets/gallery-navigation.mjs';

test('wheel momentum advances once, then requires a quiet interval and a settled scene', () => {
  const wheel = createWheelGesture();
  assert.equal(wheel({ deltaY: 30 }, 0, true), 0);
  assert.equal(wheel({ deltaY: 40 }, 20, true), 1);
  for (let t = 40; t < 1200; t += 40) assert.equal(wheel({ deltaY: 15 }, t, true), 0);
  assert.equal(wheel({ deltaY: 100 }, 1500, false), 0);
  assert.equal(wheel({ deltaY: 100 }, 1850, true), 1);
});

test('wheel handles lines, pages, reversal and ignores zoom or horizontal input', () => {
  for (const event of [{ deltaY: 3, deltaMode: 1 }, { deltaY: 1, deltaMode: 2 }]) {
    assert.equal(createWheelGesture()(event, 0, true), 1);
  }
  const wheel = createWheelGesture();
  assert.equal(wheel({ deltaY: 100, ctrlKey: true }, 0, true), 0);
  assert.equal(wheel({ deltaY: 20, deltaX: 100 }, 10, true), 0);
  assert.equal(wheel({ deltaY: 40 }, 20, true), 0);
  assert.equal(wheel({ deltaY: -40 }, 30, true), 0);
  assert.equal(wheel({ deltaY: -30 }, 40, true), -1);
});

test('touch accepts deliberate vertical swipes and flicks, rejects taps, sideways drags and holds', () => {
  assert.equal(swipeDirection(3, -65, 400, 700), 1);
  assert.equal(swipeDirection(2, 65, 400, 700), -1);
  assert.equal(swipeDirection(2, -32, 90, 700), 1);
  for (const [x,y,time] of [[0,12,100], [90,60,200], [0,80,1500]]) {
    assert.equal(swipeDirection(x,y,time,700), 0);
  }
});

test('project cycling wraps in both directions without changing its order', () => {
  const ids = ['doodle','autolister','cryptik'];
  assert.equal(adjacentProject(ids,'doodle',1), 'autolister');
  assert.equal(adjacentProject(ids,'cryptik',1), 'doodle');
  assert.equal(adjacentProject(ids,'doodle',-1), 'cryptik');
});
