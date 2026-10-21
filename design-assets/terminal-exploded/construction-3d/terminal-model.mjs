import {terminalParts,partOffset} from './terminal-assembly.mjs';

// All geometry remains editable. +Z is the common disassembly/mounting axis.
export function createTerminalModel(T,{textures=true}={}){
  const root=new T.Group();root.name='Sami Studio terminal';
  const parts=new Map(),materials=new Set(),geometries=new Set(),maps=new Set();
  const mat=(color,roughness=.4,metalness=0,extra={})=>{
    const m=new T.MeshStandardMaterial({color,roughness,metalness,...extra});materials.add(m);return m;
  };
  const cream=mat('#dfd0b7',.32),inside=mat('#b5a58f',.65),black=mat('#171b1d',.24),rubber=mat('#181b1c',.72),
    pcb=mat('#244b40',.56),copper=mat('#bfaa71',.36,.72),metal=mat('#a8abb0',.28,.85),chip=mat('#252b2b',.62),
    cap=mat('#746a60',.4),stem=mat('#d3b582',.48),lcd=mat('#acb8ae',.28,.16),amber=mat('#b86a21',.2,.2,{emissive:'#ee8b28',emissiveIntensity:.6});
  if(textures&&typeof document!=='undefined'){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
    const ctx=canvas.getContext('2d');const pixels=ctx.createImageData(128,128);let seed=17;
    for(let i=0;i<pixels.data.length;i+=4){seed=(seed*16807)%2147483647;const c=120+seed%16;pixels.data.set([c,c,c,255],i);}
    ctx.putImageData(pixels,0,0);const texture=new T.CanvasTexture(canvas);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(4,4);maps.add(texture);
    for(const material of [cream,cap]){material.bumpMap=texture;material.bumpScale=.055;}
  }
  function contour(w,h,r,path=new T.Shape()){
    const x=-w/2,y=-h/2;
    path.moveTo(x+r,y);path.lineTo(x+w-r,y);path.quadraticCurveTo(x+w,y,x+w,y+r);
    path.lineTo(x+w,y+h-r);path.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    path.lineTo(x+r,y+h);path.quadraticCurveTo(x,y+h,x,y+h-r);path.lineTo(x,y+r);path.quadraticCurveTo(x,y,x+r,y);
    return path;
  }
  function mesh(parent,geometry,material,x=0,y=0,z=0){
    geometries.add(geometry);const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  function plate(parent,w,h,d,r,material,x=0,y=0,z=0,holes=[],bevel=.5){
    const shape=contour(w-2*bevel,h-2*bevel,Math.max(.1,r-bevel));
    for(const hole of holes){const path=contour(hole.w+2*bevel,hole.h+2*bevel,hole.r+bevel,new T.Path());
      for(const curve of path.curves){for(const key of ['v0','v1','v2'])if(curve[key]){curve[key].x+=hole.x||0;curve[key].y+=hole.y||0;}}
      shape.holes.push(path);
    }
    const g=new T.ExtrudeGeometry(shape,{depth:Math.max(.2,d-2*bevel),bevelEnabled:bevel>0,bevelThickness:bevel,bevelSize:bevel,bevelSegments:3,steps:1,curveSegments:8});
    g.translate(0,0,-d/2+bevel);g.computeVertexNormals();return mesh(parent,g,material,x,y,z);
  }
  function cylinder(parent,r,length,material,x,y,z){const g=new T.CylinderGeometry(r,r,length,20);g.rotateX(Math.PI/2);return mesh(parent,g,material,x,y,z);}
  function screw(parent,x,y,z){cylinder(parent,1.7,1,metal,x,y,z);plate(parent,2,.28,.15,.1,chip,x,y,z+.6,[],.04);plate(parent,.28,2,.15,.1,chip,x,y,z+.6,[],.04);}
  function label(parent,text,w,h,x,y,z,color='#e8dfc9',bg=null,size=64){
    if(!textures||typeof document==='undefined')return;
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
    const ctx=canvas.getContext('2d');if(bg){ctx.fillStyle=bg;ctx.fillRect(0,0,512,128);}ctx.fillStyle=color;ctx.font=`500 ${size}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,64);
    const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;maps.add(map);
    const m=new T.MeshStandardMaterial({map,transparent:!bg,roughness:.55,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});materials.add(m);
    mesh(parent,new T.PlaneGeometry(w,h),m,x,y,z);
  }
  for(const p of terminalParts){const group=new T.Group();group.name=p.title;group.userData.partId=p.id;group.position.z=p.z;root.add(group);parts.set(p.id,group);}
  const rear=parts.get('rear');
  plate(rear,110,98,3,9,cream,0,0,-12);
  plate(rear,110,98,23,9,cream,0,0,1,[{w:102,h:90,r:5}],.8);
  // Inner mounting bosses and captive brass inserts share the front screw locations.
  const mounts=[[-47,40],[47,40],[-47,-40],[47,-40]];
  for(const [x,y]of mounts){cylinder(rear,3.4,20,inside,x,y,-.2);cylinder(rear,1.7,1.2,copper,x,y,10);cylinder(rear,.8,1.3,black,x,y,10.2);}
  for(let i=0;i<12;i++)plate(rear,2,18,.3,1,black,-24+i*4.4,18,-13.6,[],.1);
  for(const x of [-37,37])for(const y of [-39,39])plate(rear,12,5,2,2,rubber,x,y,-14,[],.4);
  label(rear,'SAMI STUDIO',30,5,0,-20,-13.6,'#827967');
  const board=parts.get('board');
  plate(board,98,84,1.7,4,pcb,0,-1,0,[],.15);
  // Routed tracks terminate at real components, rather than decorative random lines.
  const trackMat=mat('#9b9b63',.52,.42);
  function trace(points,width=.22){
    const curve=new T.CurvePath();for(let i=1;i<points.length;i++)curve.add(new T.LineCurve3(new T.Vector3(...points[i-1]),new T.Vector3(...points[i])));
    mesh(board,new T.TubeGeometry(curve,points.length*2,width,4,false),trackMat);
  }
  for(let i=0;i<12;i++){
    const x=-12+i*2.2;
    trace([[x,4,.94],[x,-7-i*.58,.94],[-38+i*2.1,-17-i*.58,.94],[-38+i*2.1,-29,.94]],.13);
    trace([[x,21,.94],[x,26+i*.68,.94],[28+i*.8,26+i*.68,.94],[34+i*.8,20,.94]],.13);
  }
  plate(board,24,18,2,1,chip,0,13,1.8,[],.3);label(board,'SAMI / 03',16,3,0,13,2.9,'#babfb6',null,40);
  for(let i=0;i<12;i++)for(const side of [-1,1])plate(board,.6,2.6,.5,.1,metal,-10.8+i*1.95,13+side*10,1.3,[],.08);
  for(const [x,y]of [[-32,20],[-32,3],[32,11],[30,-8]]){
    plate(board,10,6,1.6,.6,chip,x,y,1.6,[],.2);
    for(let i=0;i<4;i++)for(const side of [-1,1])plate(board,.6,1.7,.5,.1,metal,x-3.6+i*2.3,y+side*3.7,1.2,[],.05);
  }
  for(let i=0;i<14;i++){
    const x=-40+(i%7)*12,y=i<7?32:-12;
    plate(board,4,2,1,.25,stem,x,y,1.3,[],.12);
    for(const side of [-1,1])plate(board,.7,2.1,1.05,.1,metal,x+side*1.8,y,1.3,[],.05);
  }
  for(const x of [-30,0,30]){
    plate(board,17,16,2.5,2,black,x,-32,2.2,[],.4);
    plate(board,12,11,3,1.5,cap,x,-32,4.4,[],.3);
    plate(board,4,1.6,3,.2,stem,x,-32,7,[],.15);plate(board,1.6,4,3,.2,stem,x,-32,7,[],.15);
    for(const side of [-1,1])cylinder(board,.9,.3,metal,x+side*10,-32,1.1);
  }
  for(const [x,y]of mounts){cylinder(board,2,.7,copper,x,y,.9);screw(board,x,y,1.6);}
  label(board,'STUDIO / INPUT BOARD',34,3,-22,-20,1,'#c5cdb5',null,40);
  const display=parts.get('display');
  plate(display,94,63,4,5,metal,0,13,-1,[],.6);
  plate(display,92,61,4,5,black,0,13,1,[{w:82,h:50,r:2.5}],.65);
  plate(display,81,49,1.2,2.2,lcd,0,13,1.7,[],.35);
  const glass=mat('#d6ddd5',.12,.05,{transparent:true,opacity:.13});plate(display,82,50,.6,2.5,glass,0,13,2.8,[],.2);
  label(display,'Sami Studio',40,8,0,16,3.2,'#4d5b54',null,58);
  label(display,'DESIGNED + BUILT',32,4,0,7,3.2,'#63736a',null,36);
  // Folded flat-flex cable, attached to the module. Exploded view disconnects it at the board.
  plate(display,18,14,.35,.5,stem,0,-25,-3.8,[],.1);
  for(let i=0;i<12;i++)plate(display,.35,13,.1,.05,copper,-7+i*1.25,-25,-3.55,[],.02);
  plate(display,20,3,2,.5,black,0,-32,-3,[],.2);
  for(const x of [-43,43])for(const y of [-13,39])screw(display,x,y,2.4);
  const housing=parts.get('housing');
  const holes=[{w:90,h:59,r:5,x:0,y:13},...[-30,0,30].map(x=>({w:24,h:22,r:3,x,y:-32}))];
  plate(housing,110,98,6,9,cream,0,0,0,holes,.9);
  // A separately moulded graphite lining follows every opening.
  plate(housing,91,60,3,5,black,0,13,-.8,[{w:82,h:50,r:3}],.6);
  for(const x of [-30,0,30])plate(housing,25,23,3,3,rubber,x,-32,-.7,[{w:21.5,h:19.5,r:2}],.4);
  cylinder(housing,2.2,2,copper,47,-18,2.8);cylinder(housing,1.45,2.1,amber,47,-18,3.1);
  for(const [x,y]of mounts)screw(housing,x,y,-3.6);
  const keys=parts.get('keys');
  for(const [i,x]of [-30,0,30].entries()){
    // Hollow underside, small stem socket and rounded cap crown.
    plate(keys,21,19,7,2.7,cap,x,-32,-.6,[{w:16.5,h:14.5,r:1.4}],.65);
    plate(keys,21,19,2.5,2.7,cap,x,-32,3.1,[],.75);
    cylinder(keys,2.8,5,rubber,x,-32,-1);
    label(keys,['Work','About','Contact'][i],17,4.2,x,-32,4.6,'#eee4d3',null,50);
  }
  root.traverse(object=>{if(object.isMesh){object.userData.partId=object.parent.userData.partId;object.name=`${object.userData.partId} component`;}});
  function setSeparation(value){for(const p of terminalParts)parts.get(p.id).position.z=p.z+partOffset(p.id,value)[2];root.updateMatrixWorld(true);}
  return {root,parts,setSeparation,dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());maps.forEach(t=>t.dispose());}};
}
