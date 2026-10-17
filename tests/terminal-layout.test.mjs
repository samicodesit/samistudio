import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as geometry from '../assets/gallery-geometry.mjs';

test('the mobile device has an exact 32px physical gap and keeps the casing and keys above the fold',()=>{
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

test('desktop composition reserves room for both the real device and the measured headline',()=>{
  assert.equal(typeof geometry.fitDesktopTerminal,'function');
  for(const [width,height] of [[1311,1244],[1024,1024],[901,1400],[1024,1366],[1280,720],[1920,1080],[2560,1080],[3440,1440],[600,320]]) {
    if(width<1024)continue;
    const fit=geometry.fitDesktopTerminal(width,height,633.1/104);
    assert.ok(fit.scale>0);
    const deviceRight=fit.left+677*fit.scale;
    assert.ok(fit.copyLeft-deviceRight>=fit.gap-.001,`${width}x${height} must keep the text clear of the device`);
    assert.ok(fit.copyLeft+633.1/104*fit.headlineSize<=width-fit.margin+.001);
    assert.ok(fit.deviceHeight<=height*.8+.001);
    assert.ok(fit.gap>=44&&fit.gap<=112);
    assert.equal(fit.margin,width<1280?48:64);
    assert.ok(fit.contentWidth<=2560);
    assert.ok(fit.contentWidth<=width-2*fit.margin);
  }
});

test('desktop fitting remains collision free through intermediate widths and aspect ratios',()=>{
  assert.equal(typeof geometry.fitDesktopTerminal,'function');
  for(let width=1024;width<=3840;width+=29)for(const aspect of [.65,.8,1,1.05,1.25,1.5,16/9,2.4,3.6]){
    const height=Math.round(width/aspect);
    for(const textWidth of [620,633.1,670]){
      const fit=geometry.fitDesktopTerminal(width,height,textWidth/104);
      assert.ok(fit.copyLeft>=fit.left+677*fit.scale+fit.gap-.001);
      assert.ok(fit.copyLeft+textWidth/104*fit.headlineSize<=width-fit.margin+.001);
    }
  }
});


test('large desktops grow the terminal and display type together instead of staying laptop sized',()=>{
  for(const [width,height,minDevice,minType] of [[1920,1080,840,120],[2559,1228,1000,160],[3440,1440,1100,175]]){
    const fit=geometry.fitDesktopTerminal(width,height,633.1/104);
    assert.ok(fit.deviceWidth>=minDevice,`${width}: the terminal must carry the scene`);
    assert.ok(fit.headlineSize>=minType,`${width}: display type must keep pace with the terminal`);
    assert.ok(fit.brandSize>=34,'wordmark must be proportionate to the larger composition');
    assert.ok(fit.top+237*fit.scale>=0);
    assert.ok(fit.top+826*fit.scale<=height);
  }
});


test('laptop optical gutter separates the terminal silhouette from the headline without reducing display type',()=>{
  for(const [width,height] of [[1024,768],[1280,720],[1440,900],[1600,900],[1920,1080]]){
    const fit=geometry.fitDesktopTerminal(width,height,633.1/104);
    const opticalGap=fit.copyLeft-(fit.left+677*fit.scale);
    assert.ok(opticalGap>=Math.min(96,width/15)-.001, width+' needs breathing room between object and text');
    assert.ok(fit.deviceWidth>=width*.42, 'device presence is retained');
  }
});
