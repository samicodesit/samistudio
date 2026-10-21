// Retain reusable lossless layer assets and verify source-pixel registration.
import {chromium} from '../design-assets/terminal-exploded/node_modules/playwright/index.mjs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),out=root+'design-assets/terminal-exploded/layers/';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.TERMINAL_QA_BROWSER||undefined});
const page=await browser.newPage();await page.goto(process.env.TERMINAL_QA_URL||'http://127.0.0.1:43128');
await page.waitForSelector('.scene.is-ready');
const data=await page.evaluate(async()=>{
  const {construction,makeConstructionLayers}=await import('/assets/terminal-construction.mjs');
  const load=src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src='/assets/'+src.slice(2);});
  const [housing,keycaps,boardMaterial,shellMaterial]=await Promise.all([load(construction.housing),load(construction.keycaps),load('./terminal-inner-board.webp'),load('./terminal-inner-shell.webp')]);
  const built=makeConstructionLayers({housing,keycaps,boardMaterial,shellMaterial});
  const reference=document.createElement('canvas');reference.width=1686;reference.height=933;const r=reference.getContext('2d',{willReadFrequently:true});
  const report=[];
  for(const id of ['housing','display','keys']){
    r.clearRect(0,0,1686,933);r.drawImage(id==='keys'?keycaps:housing,0,0);const source=r.getImageData(0,0,1686,933).data;
    const c=built.layers.get(id).getContext('2d',{willReadFrequently:true}),pixels=c.getImageData(0,0,1686,933).data;let checked=0,mismatch=0;
    for(let y=230;y<790;y++)for(let x=40;x<690;x++){
      const i=(y*1686+x)*4;if(pixels[i+3]!==255)continue;
      // Exclude the antialiased perimeter where glass meets its backing plate.
      if(id==='display'&&![[x-2,y-2],[x+2,y-2],[x-2,y+2],[x+2,y+2]].every(([px,py])=>c.isPointInPath(built.paths.bezel,px,py)))continue;
      checked++;if(pixels[i]!==source[i]||pixels[i+1]!==source[i+1]||pixels[i+2]!==source[i+2])mismatch++;
    }
    report.push({part:id,opaqueInteriorPixelsChecked:checked,mismatchingPixels:mismatch});
  }
  const layers=Object.fromEntries([...built.layers].map(([id,c])=>[id,c.toDataURL('image/png')]));
  // Exact source-art exterior retained separately as an assembly registration reference.
  r.clearRect(0,0,1686,933);r.save();r.clip(built.paths.outer);r.drawImage(housing,0,0);r.restore();for(const path of built.paths.keys){r.save();r.clip(path);r.drawImage(keycaps,0,0);r.restore();}
  layers['exterior-reference']=reference.toDataURL('image/png');
  built.dispose();return {layers,report};
});
await browser.close();
for(const [id,url]of Object.entries(data.layers))await writeFile(out+id+'.png',Buffer.from(url.split(',')[1],'base64'));
const sources={};for(const file of ['terminal-housing.webp','terminal-keycaps.webp'])sources[file]=createHash('sha256').update(await readFile(root+'assets/'+file)).digest('hex');
const report={sources,checks:data.report};await writeFile(out+'source-registration.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
if(data.report.some(r=>r.mismatchingPixels||r.opaqueInteriorPixelsChecked<1000))process.exitCode=1;
