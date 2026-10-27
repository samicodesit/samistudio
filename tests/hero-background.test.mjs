import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { fitMobileTerminal } from '../assets/gallery-geometry.mjs';

test('terminal canvas rests until the return explicitly prepares its fitted scene',async()=>{
  const source=await readFile(new URL('../assets/studio.js',import.meta.url),'utf8');
  const layout=source.slice(source.indexOf('  function layout() {'),source.indexOf('  let audioContext;'));
  for(const [open,phase,preparingReturn,expected] of [[true,'open',undefined,0],[true,'opening',undefined,0],[true,'closing',undefined,0],[true,'closing','true',1],[false,'closed',undefined,1]]) {
    let paints=0,notifications=0;
    const context={Event,projectDialog:{open,dataset:{phase,preparingReturn}},experience:{clientWidth:393,clientHeight:711,dispatchEvent(event){assert.equal(event.type,'terminal-layout');assert.equal(paints,1,'Cutaway must update after the room plate');notifications++;}},
      matchMedia:()=>({matches:true}),ensureSceneAsset:()=>true,devicePixelRatio:1,
      activeSceneAsset:{key:'mobile'},widePhoto:{naturalWidth:0},roomPhotoReady:false,entranceAssetsReady:true,entranceScheduled:true,
      terminalEditor:null,lastLayoutKey:'',clearBackdrop(){},paintBackdrop(){paints++;},root:{style:{setProperty(){}}},
      document:{querySelector:selector=>({getBoundingClientRect:()=>({bottom:selector==='.site-header'?60:276})})},
      getComputedStyle:()=>({paddingBottom:'0px'}),fitMobileTerminal,display:{style:{}},quadMatrix:()=>'',keys:[],scene:{classList:{contains:()=>true}}};
    runInNewContext(`${layout}\nlayout();`,context);
    assert.equal(paints,expected,`${open}/${phase}`);
    assert.equal(notifications,expected,'Only completed layouts may update the cutaway');
  }
});

test('decoded room dimensions cannot publish an unprepared room plate',async()=>{
  const source=await readFile(new URL('../assets/studio.js',import.meta.url),'utf8');
  const functions=source.slice(source.indexOf('  function prepareRoomPhoto() {'),source.indexOf('  function layout() {'));
  const draws=[],gradient={addColorStop(){}},roomContext={drawImage(){},createLinearGradient:()=>gradient,fillRect(){}};
  const context={activeSceneAsset:{key:'desktop'},scenePhoto:{naturalWidth:1686},widePhoto:{width:2060,height:763,naturalWidth:2060,naturalHeight:763},
    roomPhoto:{width:300,height:150,getContext:()=>roomContext},fittedPhoto:{width:1260,height:933},window:{devicePixelRatio:1},
    backdrop:{getContext:()=>({setTransform(){},clearRect(){},drawImage(...args){draws.push(args);}}),parentElement:{classList:{add(){}}}}};
  runInNewContext(`let roomPhotoReady=false;${functions}\npaintBackdrop(1440,900,1,false,0,0);`,context);
  assert.equal(draws.length,0,'Image metadata must not substitute for a prepared plate');
  runInNewContext('prepareRoomPhoto();paintBackdrop(1440,900,1,false,0,0);',context);
  assert.equal(draws.length,3);assert.equal(draws[1][0].width,2060);assert.equal(draws[1][0].height,763);
});
