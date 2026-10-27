import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calibratedFrame} from '../assets/terminal-volume/calibration.mjs';
test('the source camera is orthonormal and preserves every traced pixel at arbitrary depth',()=>{
  for(const mobile of [false,true]){const f=calibratedFrame({mobile});const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
    for(const axis of [f.right,f.up,f.normal])assert.ok(Math.abs(dot(axis,axis)-1)<1e-10);
    assert.ok(Math.abs(dot(f.right,f.up))<1e-10);
    for(const p of [[52,356],[169,335],[568,508],[277.5,638.75],[651,727]])for(const z of [-12,0,4,28]){const q=f.project(f.unproject(p,z));assert.ok(Math.hypot(q[0]-p[0],q[1]-p[1])<1e-7);}
    const p=[30,40,12],s=f.project(p),delta=f.offset(55,12),q=f.project(p.map((v,i)=>v+delta[i]));assert.ok(Math.hypot(q[0]-s[0]-55,q[1]-s[1]-12)<1e-7);
  }
});
