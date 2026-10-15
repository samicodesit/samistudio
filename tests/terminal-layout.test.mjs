import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as geometry from '../assets/gallery-geometry.mjs';

test('the mobile device has an exact32px physical gap and keeps the casing and keys above the fold',()=>{
  assert.equal(typeof geometry.fitMobileTerminal,'function');
  for(const [width,height,bottom,safe] of [[320,480,188,0],[375,559,240,0],[393,620,260,0],[393,711,276,0],[390,844,296,34],[430,932,320,34],[768,1024,332,20]]) {
    const fit=geometry.fitMobileTerminal(width,height,bottom,safe);
    assert.ok(fit.scale>0 && fit.scale<=Math.min(width/416,1));
    assert.ok(Math.abs(fit.top+365*fit.scale-bottom-32)<.001);
    assert.ok(fit.top+790*fit.scale<=height-safe-12+.001);
    assert.ok(fit.top+724*fit.scale+3<=height-safe-.001);
    assert.ok(fit.left>=0);
  }
});
