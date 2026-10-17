import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { fitMobileTerminal } from '../assets/gallery-geometry.mjs';

test('terminal canvas rests until the return explicitly prepares its fitted scene',async()=>{
  const source=await readFile(new URL('../assets/studio.js',import.meta.url),'utf8');
  const layout=source.slice(source.indexOf('  function layout() {'),source.indexOf('  let audioContext;'));
  for(const [open,phase,preparingReturn,expected] of [[true,'open',undefined,0],[true,'opening',undefined,0],[true,'closing',undefined,0],[true,'closing','true',1],[false,'closed',undefined,1]]) {
    let paints=0;
    const context={projectDialog:{open,dataset:{phase,preparingReturn}},experience:{clientWidth:393,clientHeight:711},
      matchMedia:()=>({matches:true}),ensureSceneAsset:()=>true,devicePixelRatio:1,
      activeSceneAsset:{key:'mobile'},widePhoto:{naturalWidth:0},entranceAssetsReady:true,entranceScheduled:true,
      terminalEditor:null,lastLayoutKey:'',clearBackdrop(){},paintBackdrop(){paints++;},root:{style:{setProperty(){}}},
      document:{querySelector:selector=>({getBoundingClientRect:()=>({bottom:selector==='.site-header'?60:276})})},
      getComputedStyle:()=>({paddingBottom:'0px'}),fitMobileTerminal,display:{style:{}},quadMatrix:()=>'',keys:[],scene:{classList:{contains:()=>true}}};
    runInNewContext(`${layout}\nlayout();`,context);
    assert.equal(paints,expected,`${open}/${phase}`);
  }
});
