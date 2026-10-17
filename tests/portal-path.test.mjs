import {test} from 'node:test';
import assert from 'node:assert/strict';
import {portalCamera,parseAperture} from '../entry-paths.mjs';
import {terminalPolygon,fitMobileTerminal,fitDesktopTerminal} from '../assets/gallery-geometry.mjs';
const sizes=[[320,568],[393,711],[430,932],[568,320],[844,390],[768,1024],[1024,768],[1280,720],[1440,900],[1920,1080],[2560,1080],[3440,1440]];
const contains=(quad,p)=>quad.every((a,i)=>{const b=quad[(i+1)%4];return(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])>=-.01;});
for(const [w,h]of sizes)test('camera is finite and covers the viewport at '+w+'x'+h,()=>{
 const mobile=w<1024,fit=mobile?fitMobileTerminal(w,h,Math.min(h*.3,220),0):fitDesktopTerminal(w,h,5.8);
 const q=parseAperture(terminalPolygon({...fit,mobile},{width:w,height:h}),w,h);
 assert(portalCamera(q,w,h,0).quad.flat().every((v,i)=>Math.abs(v-q.flat()[i])<1e-9));
 for(let i=0;i<=100;i++){const camera=portalCamera(q,w,h,i/100);assert(camera.quad.flat().every(Number.isFinite));assert(!camera.transform.includes('NaN'));}
 const end=portalCamera(q,w,h,1).quad;
 assert([[0,0],[w,0],[w,h],[0,h]].every(p=>contains(end,p)),'camera aperture must cover every corner');
 assert(portalCamera(q,w,h,1-1).quad.flat().every((v,i)=>Math.abs(v-q.flat()[i])<1e-9),'reverse returns to screen corners');
});
