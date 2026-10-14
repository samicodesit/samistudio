import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

test('terminal canvas rests while the gallery is visible and resumes for closing',async()=>{
  const source=await readFile(new URL('../assets/studio.js',import.meta.url),'utf8');
  const layout=source.slice(source.indexOf('  function layout() {'),source.indexOf('  let audioContext;'));
  for(const [open,phase,expected] of [[true,'open',0],[true,'opening',0],[true,'closing',1],[false,'closed',1]]) {
    let paints=0;
    const context={projectDialog:{open,dataset:{phase}},experience:{clientWidth:393,clientHeight:711},
      matchMedia:()=>({matches:true}),ensureSceneAsset:()=>true,devicePixelRatio:1,
      activeSceneAsset:{key:'mobile'},widePhoto:{naturalWidth:0},entranceAssetsReady:true,entranceScheduled:true,
      lastLayoutKey:'',clearBackdrop(){},paintBackdrop(){paints++;},root:{style:{setProperty(){}}},
      display:{style:{}},quadMatrix:()=>'',keys:[],scene:{classList:{contains:()=>true}}};
    runInNewContext(`${layout}\nlayout();`,context);
    assert.equal(paints,expected,`${open}/${phase}`);
  }
});
