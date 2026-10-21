// Source registration is in untouched 1686 x 933 homepage artwork coordinates.
// Visible exterior pixels are preserved. Only unseen interior surfaces are drawn.
export const construction=Object.freeze({width:1686,height:933,housing:'./terminal-housing.webp',keycaps:'./terminal-keycaps.webp',
  outer:'M 52 356 Q 50 325 80 299 L 104 281 Q 116 269 149 266 L 518 237 Q 552 233 569 263 L 673 651 Q 685 699 665 719 Q 657 729 640 732 L 197 778 Q 167 784 143 769 L 81 719 Q 52 694 52 662 Z',
  face:'M 147 266 L 520 238 Q 558 234 574 274 L 674 652 Q 687 707 651 727 L 196 778 Q 151 786 139 746 L 97 332 Q 91 278 147 266 Z',
  bezel:'M 161 293 L 523 271 Q 548 269 555 296 L 601 506 Q 610 533 583 539 L 204 576 Q 180 579 174 550 L 136 327 Q 131 302 161 293 Z',
  screen:[[169,335],[526,306],[568,508],[209,549]],
  keyMounts:[[277.5,638.75],[414,621.75],[552.75,607.5]],
  keyPaths:[
    {x:200,y:590,w:143,h:130,path:'M .22 .135 L .74 .06 C .82 .045 .865 .085 .89 .18 L .97 .77 C .985 .84 .965 .87 .9 .89 L .27 .97 C .20 .98 .16 .945 .14 .86 L .035 .36 C .015 .27 .055 .21 .13 .18 Z'},
    {x:333,y:574,w:146,h:129,path:'M .22 .135 L .74 .06 C .82 .045 .865 .085 .89 .18 L .97 .77 C .985 .84 .965 .87 .9 .89 L .27 .97 C .20 .98 .16 .945 .14 .86 L .035 .36 C .015 .27 .055 .21 .13 .18 Z'},
    {x:473,y:560,w:146,h:125,path:'M .11 .16 L .76 .04 L .85 .08 L .94 .40 L .99 .78 L .94 .91 L .23 .98 L .13 .93 L .01 .32 L .03 .23 Z'},
  ],
});
export const mobileConstruction=Object.freeze({
  width:416,height:932,mobile:true,housing:'./terminal-housing-mobile.webp',keycaps:'./terminal-keycaps-mobile.webp',
  outer:'M 55 365 L 352 365 Q 390 365 394 403 L 404 714 Q 408 760 367 766 L 57 767 Q 12 767 13 720 L 20 412 Q 20 365 55 365 Z',
  face:'M 56 366 L 353 366 Q 390 366 394 405 L 403 714 Q 405 756 367 763 L 59 763 Q 25 763 25 725 L 27 409 Q 27 366 56 366 Z',
  bezel:'M 69 388 L 348 388 Q 372 388 373 411 L 374 585 Q 374 610 350 611 L 62 611 Q 42 611 43 588 L 45 413 Q 45 388 69 388 Z',
  screen:[[73,419],[346,419],[346,588],[73,588]],keyMounts:[[100,674],[205,674],[310,674]],
  projection:[3.65,0,0,3.85,26,376],bounds:{x:8,y:360,width:401,height:420},
  keyPaths:[51,156,261].map((x,i)=>({x,y:630,w:98,h:94,path:i===2?'M .12 .032 H .88 Q .99 .032 .99 .15 V .83 Q .99 .947 .88 .947 H .12 Q .01 .947 .01 .83 V .15 Q .01 .032 .12 .032 Z':'M .15 .032 H .85 Q .96 .032 .96 .15 V .80 Q .96 .925 .85 .925 H .15 Q .04 .925 .04 .80 V .15 Q .04 .032 .15 .032 Z'})),
});
const travels={rear:-490,board:-250,display:0,housing:265,keys:475};
export function frontPlanePoint(x,y){return [130+4.38*x+.9*y,280-.35*x+4.55*y];}
export function inverseFrontPlane(x,y){const a=x-130,b=y-280,d=4.38*4.55+.9*.35;return [(4.55*a-.9*b)/d,(.35*a+4.38*b)/d];}
export function layerPose(id,value,axis={x:1,y:.23}){
  if(!(id in travels))throw new Error('Unknown part: '+id);
  const t=Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;
  return {x:t?travels[id]*t*axis.x:0,y:t?travels[id]*t*axis.y:0};
}
export function makeConstructionLayers({housing,keycaps,boardMaterial,shellMaterial,page=document,variant=construction}){
  const construction=variant;
  const make=()=>{const c=page.createElement('canvas');c.width=construction.width;c.height=construction.height;c.getContext('2d',{willReadFrequently:true});return c;};
  const outer=new Path2D(construction.outer),face=new Path2D(construction.face),bezel=new Path2D(construction.bezel);
  const keys=construction.keyPaths.map(k=>{const p=new Path2D();p.addPath(new Path2D(k.path),new DOMMatrix([k.w,0,0,k.h,k.x,k.y]));return p;});
  const result=new Map();
  const image=(ctx,path,photo)=>{ctx.save();ctx.clip(path);ctx.drawImage(photo,0,0);ctx.restore();};
  function panel(ctx,x,y,w,h,r,fill,stroke=null,line=.3){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.lineWidth=line;ctx.strokeStyle=stroke;ctx.stroke();}}
  const project=ctx=>ctx.transform(...(construction.projection||[4.38,-.35,.9,4.55,130,280]));
  const rear=make(),r=rear.getContext('2d');image(r,outer,housing);
  r.save();r.clip(face);
  const backFace=r.createLinearGradient(100,250,650,780);backFace.addColorStop(0,'#e7d9bd');backFace.addColorStop(.6,'#c3ae96');backFace.addColorStop(1,'#887465');r.fillStyle=backFace;r.fillRect(0,0,construction.width,construction.height);project(r);
  const cavity=r.createLinearGradient(0,0,100,90);cavity.addColorStop(0,'#6c5b50');cavity.addColorStop(.12,'#a18d79');cavity.addColorStop(.28,'#b4a28c');cavity.addColorStop(.84,'#d4c4aa');cavity.addColorStop(1,'#8c7667');
  panel(r,3,4,93,93,7,cavity,'#ddcdb4',1.2);
  const inner=r.createLinearGradient(0,0,90,90);inner.addColorStop(0,'#b5a28b');inner.addColorStop(.55,'#c5b49b');inner.addColorStop(1,'#d8c8ad');
  panel(r,8,10,82,81,5,inner,'#806b5c',.5);
  for(const x of [14,86])panel(r,x-1,14,1.4,67,.5,'#ad9881');
  for(const [x,y]of [[13,13],[86,13],[13,86],[86,86]]){
    r.beginPath();r.arc(x,y,3.5,0,Math.PI*2);r.fillStyle='#a68e73';r.fill();r.strokeStyle='#dfcbb0';r.lineWidth=.55;r.stroke();
    r.beginPath();r.arc(x,y,1.5,0,Math.PI*2);r.fillStyle='#b9985d';r.fill();r.beginPath();r.arc(x,y,.75,0,Math.PI*2);r.fillStyle='#453c35';r.fill();
  }
  r.fillStyle='#8e7b67';r.font='2.2px Arial';r.textAlign='center';r.fillText('SAMI STUDIO',50,46);r.fillText('DESIGNED + BUILT',50,50);
  if(shellMaterial)r.drawImage(shellMaterial,0,0,100,100);
  r.restore();result.set('rear',rear);
  const board=make(),b=board.getContext('2d');b.save();project(b);
  panel(b,7,7,86,86,3,'#203f36','#92906a',.65);
  b.lineWidth=.22;b.strokeStyle='#a49760';
  for(let i=0;i<14;i++){
    const x=40+i*.9,y=46+i*.7;b.beginPath();b.moveTo(x,35);b.lineTo(x,y);b.lineTo(20+i*3.4,y+9);b.lineTo(20+i*3.4,77);b.stroke();
    b.beginPath();b.moveTo(x,24);b.lineTo(x,19-i*.48);b.lineTo(68+i*.8,19-i*.48);b.lineTo(76+i*.65,29);b.stroke();
  }
  function ic(x,y,w,h){panel(b,x,y,w,h,.7,'#151f1d','#53645b',.15);for(let i=0;i<8;i++)for(const side of [-1,1])panel(b,x+1+i*(w-2)/8,y+h/2+side*(h/2+.7),.45,1.5,.1,'#b5b4a0');}
  ic(35,25,24,17);ic(15,31,11,9);ic(71,33,11,9);ic(67,53,13,8);
  b.fillStyle='#a2ad9b';b.font='2.4px Arial';b.textAlign='center';b.fillText('STUDIO / 03',47,34);
  for(let i=0;i<12;i++){const x=15+i%6*12,y=i<6?17:60;panel(b,x,y,3.5,1.7,.2,'#bdac7a');panel(b,x,y,.6,1.7,.1,'#d6d0b8');panel(b,x+2.9,y,.6,1.7,.1,'#d6d0b8');}
  for(const point of construction.keyMounts){
    const [x,y]=construction.mobile?[(point[0]-26)/3.65,(point[1]-376)/3.85]:inverseFrontPlane(...point);
    panel(b,x-9,y-8,18,16,2,'#131c1a','#535b4b',.3);panel(b,x-6,y-5,12,10,1,'#685b4e');panel(b,x-1.2,y-4,2.4,8,.3,'#c6a67d');panel(b,x-4,y-1.2,8,2.4,.3,'#c6a67d');
    for(const dx of [-7,7]){b.beginPath();b.arc(x+dx,y-10,.75,0,Math.PI*2);b.fillStyle='#b6ac84';b.fill();}
  }
  for(const [x,y]of [[13,13],[86,13],[13,86],[86,86]]){b.beginPath();b.arc(x,y,2.1,0,Math.PI*2);b.fillStyle='#b3a876';b.fill();b.beginPath();b.arc(x,y,.8,0,Math.PI*2);b.fillStyle='#172c24';b.fill();}
  panel(b,36,9,29,3,1,'#b8b6a5');for(let i=0;i<20;i++)panel(b,38+i*1.2,9,.4,3,.1,'#cbbd86');
  b.font='1.8px Arial';b.fillStyle='#aeb398';b.textAlign='left';b.fillText('SAMI STUDIO / INPUT',14,69);
  if(boardMaterial){b.save();b.beginPath();b.roundRect(7,7,86,86,3);b.clip();b.drawImage(boardMaterial,7,7,86,86);b.restore();}
  b.restore();result.set('board',board);
  const display=make(),d=display.getContext('2d');d.save();project(d);panel(d,4,3,92,64,5,'#44423e','#a4a098',.7);
  panel(d,39,65,19,13,.6,'#b5a270');for(let i=0;i<13;i++)panel(d,40+i*1.3,65,.25,12,.1,'#d5bc79');panel(d,37.5,77,22,2.5,.5,'#242c28');d.restore();image(d,bezel,housing);result.set('display',display);
  const front=make(),f=front.getContext('2d');f.save();f.clip(face);f.drawImage(housing,0,0);f.globalCompositeOperation='destination-out';f.fill(bezel);
  for(const [i,k]of construction.keyPaths.entries()){
    const outline=page.querySelector(`#terminal-socket-${construction.mobile?'mobile-':''}${['work','about','contact'][i]} path`)?.getAttribute('d');
    if(outline){const p=new Path2D();p.addPath(new Path2D(outline),new DOMMatrix([k.w,0,0,k.h,k.x,k.y]));f.fill(p);}else f.fill(keys[i]);
  }
  f.restore();result.set('housing',front);
  const caps=make(),c=caps.getContext('2d');for(const [i,path]of keys.entries()){
    if(construction.mobile){c.save();c.clip(path);const k=construction.keyPaths[i];c.drawImage(keycaps,i===2?210:105,0,98,94,k.x,k.y,98,94);c.restore();}
    else image(c,path,keycaps);
  }result.set('keys',caps);
  return {layers:result,paths:{outer,face,bezel,keys},dispose(){for(const layer of result.values())layer.width=layer.height=1;}};
}
