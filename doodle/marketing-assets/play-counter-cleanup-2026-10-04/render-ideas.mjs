import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import sharp from 'sharp';
const root = path.dirname(fileURLToPath(import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export async function renderIdeasScreenshot() {
  const original = await fs.readFile(path.join(root, '03-original.png'));
  const design = await fs.readFile(path.join(root, '03-imagegen-layout.png'));
  const font = await fs.readFile(path.join(root, '../../mobile/assets/IBMPlexSans-Variable.ttf'));
  const labels = ['A thank-you note', 'A curious cat', 'A birthday dog'];
  const sources = ['thank-you-mug', 'cat-note', 'birthday-dog'];
  const artworks = await Promise.all(sources.map(async name => {
    const source = `public/ideas/${name}.webp`;
    const bytes = await fs.readFile(path.join(root, '../../', source));
    return { source, sha256: hash(bytes), data: `data:image/webp;base64,${bytes.toString('base64')}` };
  }));
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
  @font-face{font-family:Plex;src:url(data:font/ttf;base64,${font.toString('base64')}) format('truetype');font-weight:100 900}
  *{box-sizing:border-box;letter-spacing:0}html,body{margin:0;width:936px;height:1464px;overflow:hidden;background:#eef1ea;color:#20231f;font-family:Plex}
  main{padding:32px;display:grid;gap:32px}article{width:872px;height:440px;display:flex;border:1px solid #dce1d8;border-radius:38px;overflow:hidden;background:#fcfcf8}
  img{width:440px;height:440px;object-fit:cover;flex:none}.body{padding:42px 32px;flex:1;display:flex;flex-direction:column;justify-content:space-between}
  p{margin:0;font:400 42px/1.25 Plex}.action{display:flex;align-items:center;justify-content:space-between;color:#1a614d;font:600 36px/1.2 Plex;gap:16px}svg{width:28px;height:28px;flex:none}
  </style></head><body><main>${artworks.map((art,i)=>`<article><img src="${art.data}" alt="${labels[i]}"><div class="body"><p>${labels[i]}</p><div class="action">Try this idea<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg></div></div></article>`).join('')}</main></body></html>`;
  const browser = await chromium.launch({headless:true});
  let panel, qa;
  try {
    const page = await browser.newPage({viewport:{width:936,height:1464},deviceScaleFactor:1});
    await page.setContent(html);
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForFunction(()=>[...document.images].every(img=>img.complete&&img.naturalWidth>0));
    qa = await page.evaluate(()=>({fonts:[...document.fonts].map(f=>({family:f.family,status:f.status})),overflow:document.documentElement.scrollWidth>936||document.documentElement.scrollHeight>1464,labels:[...document.querySelectorAll('p')].map(p=>({text:p.textContent,clipped:p.scrollWidth>p.clientWidth}))}));
    if(qa.overflow||qa.fonts.some(f=>f.status!=='loaded')||qa.labels.some(p=>p.clipped))throw Error(JSON.stringify(qa));
    panel = await page.screenshot();
  } finally {await browser.close();}
  const region={left:72,top:360,width:936,height:1464};
  const output = await sharp(original).composite([{input:panel,left:72,top:360}]).removeAlpha().png().toBuffer();
  const before=await sharp(original).removeAlpha().raw().toBuffer();
  const after=await sharp(output).raw().toBuffer();
  let changedOutside=0;
  for(let y=0;y<1920;y++)for(let x=0;x<1080;x++)if(x<72||x>=1008||y<360||y>=1824){const i=(y*1080+x)*3;if(before[i]!==after[i]||before[i+1]!==after[i+1]||before[i+2]!==after[i+2])changedOutside++;}
  if(changedOutside)throw Error('Outer caption or background changed');
  await fs.writeFile(path.join(root,'exports/03-find-an-idea.png'),output);
  await sharp(output).resize({width:390}).png().toFile(path.join(root,'03-phone-review.png'));
  return {slot:3,file:'exports/03-find-an-idea.png',source:'03-original.png',sourceSha256:hash(original),sha256:hash(output),imageGenDesignReference:'03-imagegen-layout.png',imageGenSha256:hash(design),method:'Image Gen layout direction, re-exported with original example artwork and IBM Plex Sans. Only the inner panel is recomposed. Outer caption and backdrop are pixel-identical.',artworks:artworks.map(({data,...record})=>record),fontSha256:hash(font),region,changedOutside,qa,reviewStatus:'Agent visual review pending. Owner acceptance and publishing approval pending.'};
}
