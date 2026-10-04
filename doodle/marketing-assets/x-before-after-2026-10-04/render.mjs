import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const dir=new URL('./',import.meta.url);
const hash=b=>createHash('sha256').update(b).digest('hex');
const before=await readFile(new URL('before.jpg',dir));
const after=await readFile(new URL('after.jpg',dir));
const bg='#EEF1EA';
// Actual captures, cropped only to frame the relevant website content.
const b=await sharp(before).extract({left:20,top:0,width:1210,height:800}).resize(736,600,{fit:'contain',background:bg}).png().toBuffer();
const a=await sharp(after).extract({left:696,top:0,width:1168,height:916}).resize(736,600,{fit:'contain',background:bg}).png().toBuffer();
// SVG text uses Fontconfig. Register the approved Bricolage Grotesque font before rendering.
const text=Buffer.from(`<svg width="1600" height="760"><text x="800" y="65" text-anchor="middle" font-family="Bricolage Grotesque" font-size="44" font-weight="650" fill="#20231F">Before / After</text></svg>`);
const frames=Buffer.from('<svg width="1600" height="760"><defs><filter id="shadow" x="-10%" y="-10%" width="120%" height="125%"><feGaussianBlur stdDeviation="5"/></filter></defs><g fill="#29382D" opacity="0.08" filter="url(#shadow)"><rect x="36" y="115" width="760" height="624" rx="14"/><rect x="804" y="115" width="760" height="624" rx="14"/></g><g fill="#F8FAF5" stroke="#CBD5C8" stroke-width="2"><rect x="36" y="110" width="760" height="624" rx="14"/><rect x="804" y="110" width="760" height="624" rx="14"/></g></svg>');
const output=await sharp({create:{width:1600,height:760,channels:3,background:bg}}).composite([{input:frames},{input:b,left:48,top:122},{input:a,left:816,top:122},{input:text}]).png().toBuffer();
await writeFile(new URL('doodle-before-after.png',dir),output);
await sharp(output).resize({width:780}).png().toFile(fileURLToPath(new URL('phone-review.png',dir)));
await writeFile(new URL('manifest.json',dir),JSON.stringify({status:'Prepared for X, not posted. Owner requested framed UI comparison with one Before / After heading and no other overlay text. Visual QA pending.',output:'doodle-before-after.png',sha256:hash(output),dimensions:{width:1600,height:760},sources:[{label:'Early version',path:'before.jpg',sha256:hash(before),url:'https://doodle-oaw4cp8op-ahmed-samis-projects-e6ef0336.vercel.app',deploymentId:'dpl_7E2U2rzAQxZAqtf8X1p5YKRjucKL',date:'2026-09-23',playButtonPresent:false},{label:'Today',path:'after.jpg',sha256:hash(after),url:'https://doodle.samistudio.nl',deploymentId:'dpl_94xaVdn7f4FSRjPcyeren3PjYM1o',date:'2026-10-04'}],method:'Actual website captures through CUA. Cropped and scaled to frame the UI. Restrained frames distinguish the two captures. No generative edits or reconstructed UI. Current capture uses the existing signed-in browser account; its credit count is visible, not an offer.',fonts:['Bricolage Grotesque','IBM Plex Sans'],purpose:'Show website design progress to the owner\'s X audience, with an understandable cards, notes and journals use case. No growth or performance claims.',alt:'Doodle website before and after. The early version has a large yellow cat doodle beside a scene input. Today\'s layout adds a visual detail selector, a cat holding a flower, and three varied drawing examples beneath the input.'},null,2)+'\n');
console.log(JSON.stringify({sha256:hash(output)}));
