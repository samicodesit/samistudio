import * as T from './vendor/three.mjs';
import {frontPlanePoint} from '/assets/terminal-construction.mjs';
import {projectiveMatrix} from '/assets/gallery-geometry.mjs';

// Traced source profiles become solid geometry. The source camera supplies UVs.
export function buildVolumeModel({frame,variant,textures,screenTexture,labelTextures,page=document}){
  const root=new T.Group(),parts=new Map(),resources=[],depth={rear:3,board:1.8,display:2,housing:2.6,keys:8},mountPairs=[],boardMountPairs=[];
  const keyCentres=variant.keyMounts.map(p=>frame.unproject(p,-2));
  const material=(colour,roughness=.45,metalness=0)=>{const m=new T.MeshPhysicalMaterial({color:colour,roughness,metalness,clearcoat:metalness?0:.08,clearcoatRoughness:.65,specularIntensity:metalness?1:.45});resources.push(m);return m;};
  const cream=material('#cbb7a8',.36),inside=material('#d3c3aa',.52),metal=material('#747574',.3,.75),green=material('#193d30',.56),brown=material('#39252f',.4),gold=material('#a8854a',.25,.65),black=material('#17191a',.48);
  const stemPlastic=material('#d8c7a6',.34),switchPlastic=material('#4c4b41',.46);
  const grain=page.createElement('canvas');grain.width=grain.height=256;const gc=grain.getContext('2d'),gi=gc.createImageData(256,256);for(let y=0;y<256;y++)for(let x=0;x<256;x++){const i=(y*256+x)*4;let v=Math.imul(x+y*256+71,1597334677);v^=v>>>16;v=Math.imul(v,2246822519);v^=v>>>13;const n=112+((v>>>24)&31);gi.data[i]=gi.data[i+1]=gi.data[i+2]=n;gi.data[i+3]=255;}gc.putImageData(gi,0,0);const micro=new T.CanvasTexture(grain);micro.wrapS=micro.wrapT=T.RepeatWrapping;micro.repeat.set(6,6);resources.push(micro);for(const m of [cream,inside,brown]){m.bumpMap=micro;m.bumpScale=.004;}
  const photo=new Map();for(const [id,map]of textures){map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;const m=new T.MeshBasicMaterial({map,transparent:true,alphaTest:.2,side:T.DoubleSide});photo.set(id,m);resources.push(m,map);}
  function sample(d,count=512,transform=null){const path=page.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',d);const length=path.getTotalLength();return Array.from({length:count},(_,i)=>{const p=path.getPointAtLength(i/count*length);return transform?transform(p):[p.x,p.y];});}
  const source={outer:sample(variant.outer),face:sample(variant.face),bezel:sample(variant.bezel),keys:variant.keyPaths.map(k=>sample(k.path,80,p=>[k.x+p.x*k.w,k.y+p.y*k.h]))};
  source.sockets=variant.keyPaths.map((k,i)=>{const d=page.querySelector(`#terminal-socket-${variant.mobile?'mobile-':''}${['work','about','contact'][i]} path`)?.getAttribute('d')||k.path;return sample(d,80,p=>[k.x+p.x*k.w,k.y+p.y*k.h]);});
  const srcPlane=(x,y)=>variant.mobile?[26+3.65*x,376+3.85*y]:frontPlanePoint(x,y);
  const loop=(points,z=0)=>points.map(p=>frame.unproject(p,z));
  function shape(points,holes=[],z=0){const outer=loop(points,z),s=new T.Shape(outer.map(p=>new T.Vector2(p[0],p[1])));for(const hole of holes)s.holes.push(new T.Path(loop(hole,z).map(p=>new T.Vector2(p[0],p[1]))));return s;}
  function uv(geometry){const p=geometry.getAttribute('position'),values=[];for(let i=0;i<p.count;i++){const q=frame.project([p.getX(i),p.getY(i),p.getZ(i)]);values.push(q[0]/frame.width,1-q[1]/frame.height);}geometry.setAttribute('uv',new T.Float32BufferAttribute(values,2));return geometry;}
  function add(parent,geometry,materials){resources.push(geometry);const mesh=new T.Mesh(geometry,materials);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  function solid(parent,points,z,thickness,side,front,holes=[],bevel=0){
    const geometry=new T.ExtrudeGeometry(shape(points,holes,z),{depth:Math.max(.01,thickness-bevel*2),bevelEnabled:bevel>0,bevelThickness:bevel,bevelSize:bevel,bevelSegments:6,steps:1,curveSegments:12});geometry.translate(0,0,z+bevel);uv(geometry);
    // ExtrudeGeometry groups both end caps together. Give only the observed
    // front cap the calibrated photograph; the reverse has its own material.
    const normal=geometry.getAttribute('normal');geometry.clearGroups();let start=0,last=-1;
    for(let i=0;i<normal.count;i+=3){const current=normal.getZ(i)<-.999?0:1;if(current!==last){if(last>=0)geometry.addGroup(start,i-start,last);start=i;last=current;}}
    geometry.addGroup(start,normal.count-start,last);return add(parent,geometry,[front,side]);
  }
  function rounded(x,y,w,h,r,steps=8){const points=[];for(const [cx,cy,angle]of [[x+w-r,y+r,-Math.PI/2],[x+w-r,y+h-r,0],[x+r,y+h-r,Math.PI/2],[x+r,y+r,Math.PI]])for(let i=0;i<=steps;i++){const a=angle+i/steps*Math.PI/2;points.push(srcPlane(cx+Math.cos(a)*r,cy+Math.sin(a)*r));}return points;}
  function worldRounded(p,w,h,r,z){const points=[];for(const [cx,cy,a]of [[p[0]+w/2-r,p[1]-h/2+r,-Math.PI/2],[p[0]+w/2-r,p[1]+h/2-r,0],[p[0]-w/2+r,p[1]+h/2-r,Math.PI/2],[p[0]-w/2+r,p[1]-h/2+r,Math.PI]])for(let i=0;i<=10;i++){const t=a+i/10*Math.PI/2;points.push(frame.project([cx+Math.cos(t)*r,cy+Math.sin(t)*r,z]));}return points;}
  function circle(p,r,z){return Array.from({length:64},(_,i)=>frame.project([p[0]+Math.cos(i/64*Math.PI*2)*r,p[1]+Math.sin(i/64*Math.PI*2)*r,z]));}
  function cross(p,arm,halfWidth,z){return [[-halfWidth,-arm],[halfWidth,-arm],[halfWidth,-halfWidth],[arm,-halfWidth],[arm,halfWidth],[halfWidth,halfWidth],[halfWidth,arm],[-halfWidth,arm],[-halfWidth,halfWidth],[-arm,halfWidth],[-arm,-halfWidth],[-halfWidth,-halfWidth]].map(([x,y])=>frame.project([p[0]+x,p[1]+y,z]));}
  const boardCentres=[[13,13],[86,13],[13,86],[86,86]].map(p=>frame.unproject(srcPlane(...p),1));
  function component(parent,x,y,w,h,z,thickness,side,front=side,r=.6){return solid(parent,rounded(x,y,w,h,r),z,thickness,side,front);}
  function cylinder(parent,sourcePoint,z,r,length,m){const p=frame.unproject(sourcePoint,z);const g=new T.CylinderGeometry(r,r,length,32);g.rotateX(Math.PI/2);g.translate(p[0],p[1],p[2]+length/2);return add(parent,g,m);}
  function rib(parent,a,b,z,width,height,m){const p=frame.unproject(a,z),q=frame.unproject(b,z),g=new T.BoxGeometry(Math.hypot(q[0]-p[0],q[1]-p[1]),width,height);g.rotateZ(Math.atan2(q[1]-p[1],q[0]-p[0]));g.translate((p[0]+q[0])/2,(p[1]+q[1])/2,z+height/2);return add(parent,g,m);}
  function decal(parent,points,z,texture){
    const h=projectiveMatrix(1,1,points).slice(9,-1).split(',').map(Number),positions=[],coords=[],indices=[],nx=32,ny=20;
    for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){const u=x/nx,v=y/ny,w=h[3]*u+h[7]*v+1,p=[(h[0]*u+h[4]*v+h[12])/w,(h[1]*u+h[5]*v+h[13])/w];positions.push(...frame.unproject(p,z));coords.push(u,1-v);}
    for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const i=y*(nx+1)+x;indices.push(i,i+nx+2,i+1,i,i+nx+1,i+nx+2);}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(coords,2));g.setIndex(indices);g.computeVertexNormals();const m=new T.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.01,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2});resources.push(texture,m);add(parent,g,m);
  }
  function loft(parent,front,back,z0,z1,frontMaterial,sideMaterial){
    const a=loop(front,z0),b=loop(back,z1),positions=[];for(let i=0;i<a.length;i++){const j=(i+1)%a.length;positions.push(...a[i],...a[j],...b[j],...a[i],...b[j],...b[i]);}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.computeVertexNormals();uv(g);if(frontMaterial&&frontMaterial!==sideMaterial){const n=g.getAttribute('normal');for(let i=0;i<n.count;i+=3){const facing=n.getX(i)*frame.normal[0]+n.getY(i)*frame.normal[1]+n.getZ(i)*frame.normal[2];g.addGroup(i,3,facing>0?0:1);}add(parent,g,[frontMaterial,sideMaterial]);}else add(parent,g,sideMaterial);return g;
  }
  for(const id of ['rear','board','display','housing','keys']){const group=new T.Group();group.name=id;group.userData.partId=id;root.add(group);parts.set(id,group);}
  const rear=parts.get('rear'),face=source.face,center=face.reduce((a,p)=>[a[0]+p[0]/face.length,a[1]+p[1]/face.length],[0,0]);
  const innerFace=face.map(p=>[center[0]+(p[0]-center[0])*.89,center[1]+(p[1]-center[1])*.89]);
  const back=variant.mobile?face.map(p=>[center[0]+(p[0]-center[0])*.95,center[1]+(p[1]-center[1])*.95]):sample('M 82 300 L 481 270 Q 505 269 513 293 L 564 627 Q 569 653 544 665 L 102 725 Q 67 726 54 691 L 52 357 Q 50 324 82 300 Z',face.length);
  const rings=[{points:loop(face,3),t:0},{points:loop(face,3).map((p,i)=>p.map((v,c)=>v*.92+loop(back,31)[i][c]*.08)),t:.08},{points:loop(back,31),t:1}];
  const positions=rings.flatMap(r=>r.points.flat()),indices=[];for(let k=0;k<rings.length-1;k++)for(let i=0;i<face.length;i++){const j=(i+1)%face.length,a=k*face.length+i,b=k*face.length+j,c=(k+1)*face.length+j,d=(k+1)*face.length+i;indices.push(a,b,c,a,c,d);}
  const wall=new T.BufferGeometry();wall.setAttribute('position',new T.Float32BufferAttribute(positions,3));wall.setIndex(indices);wall.computeVertexNormals();uv(wall);const wallPhoto=new T.MeshBasicMaterial({map:textures.get('rearExterior')});resources.push(wallPhoto);
  const normals=wall.getAttribute('normal');wall.clearGroups();let start=0,last=-1;for(let i=0;i<indices.length;i+=3){const v=indices[i],dot=normals.getX(v)*frame.normal[0]+normals.getY(v)*frame.normal[1]+normals.getZ(v)*frame.normal[2],m=dot>0?0:1;if(m!==last){if(last>=0)wall.addGroup(start,i-start,last);start=i;last=m;}}wall.addGroup(start,indices.length-start,last);add(rear,wall,[wallPhoto,cream]);
  solid(rear,face,3,1.2,cream,photo.get('rear'),[innerFace]);
  solid(rear,back,30,2,cream,cream);
  const backWorld=loop(back,31),backCenter=backWorld.reduce((a,p)=>[a[0]+p[0]/backWorld.length,a[1]+p[1]/backWorld.length],[0,0]),innerFloor=backWorld.map(p=>frame.project([backCenter[0]+(p[0]-backCenter[0])*.89,backCenter[1]+(p[1]-backCenter[1])*.89,27]));
  const floor=inside.clone();floor.bumpMap=null;floor.roughness=.6;resources.push(floor);solid(rear,innerFloor,27,.8,floor,floor);
  loft(rear,innerFloor,innerFace,27,4.2,inside,inside);
  const rearMounts=boardCentres.map(p=>{
    solid(rear,circle(p,3.3,24),24,3,inside,inside,[circle(p,1.1,24)]);
    solid(rear,circle(p,2.2,2.7),2.7,21.5,inside,inside,[circle(p,1.1,2.7)]);
    return solid(rear,circle(p,1.8,2.6),2.6,.2,gold,gold,[circle(p,1.1,2.6)]);
  });
  const boardSkin=material('#bcbcbc',.58,.08);boardSkin.map=textures.get('boardBare')||textures.get('board');boardSkin.bumpMap=micro;boardSkin.bumpScale=.004;
  const board=parts.get('board'),boardBase=solid(board,rounded(7,7,86,86,3),1,1.6,green,boardSkin,boardCentres.map(p=>circle(p,1.1,1)));
  for(const [x,y,w,h]of [[38,31,23,18],[15,24,9,8],[68,40,7,8],[74,54,7,9]]){
    solid(board,worldRounded([x+w/2,y+h/2],w,h,.5,-1.2),-1.2,2.1,black,black,[],.12);
    const count=w>20?14:5;for(let i=0;i<count;i++)for(const side of [-1,1])solid(board,worldRounded([x+1+(w-2)*i/(count-1),y+h/2+side*(h/2+.7)],.45,1.5,.1,.3),.3,.55,metal,metal);
  }
  for(let i=0;i<12;i++){const x=15+i%6*12,y=i<6?17:59;solid(board,worldRounded([x,y],2.8,1.3,.18,.1),.1,.9,switchPlastic,switchPlastic);for(const dx of [-1.4,1.4])solid(board,worldRounded([x+dx,y],.5,1.3,.08,.05),.05,1,metal,metal);}
  const stems=keyCentres.map(p=>{solid(board,worldRounded(p,16,14,1.6,-2.5),-2.5,3.5,black,black);solid(board,worldRounded(p,11,9,1,-3.4),-3.4,1,switchPlastic,switchPlastic);return solid(board,cross(p,2.05,.55,-5.3),-5.3,2.9,stemPlastic,stemPlastic);});
  boardCentres.forEach((p,i)=>{const ring=solid(board,circle(p,2,.7),.7,.4,gold,gold,[circle(p,1.1,.7)]);boardMountPairs.push({a:ring,b:rearMounts[i]});});
  const display=parts.get('display'),displayCarrier=solid(display,source.bezel,-2.6,3.3,metal,photo.get('display'));
  const flex=material('#b58d4d',.42,.25),flexPositions=[],flexUV=[],flexIndices=[],rows=24;
  const flexStart=variant.mobile?60.5:64;
  for(let layer=0;layer<2;layer++)for(let i=0;i<=rows;i++){const t=i/rows,z=-1.8+2.2*t*t*(3-2*t)+layer*.12;for(const x of [39,58]){flexPositions.push(x,flexStart+(70.2-flexStart)*t,z);flexUV.push((x-39)/19,t);}}
  for(let layer=0;layer<2;layer++)for(let i=0;i<rows;i++){const a=layer*(rows+1)*2+i*2,b=a+1,c=a+2,d=a+3;flexIndices.push(...(layer?[a,b,c,b,d,c]:[a,c,b,b,c,d]));}
  for(let i=0;i<rows;i++)for(const side of [0,1]){const a=i*2+side,b=a+2,c=a+(rows+1)*2,d=b+(rows+1)*2;flexIndices.push(a,b,c,b,d,c);}
  const fg=new T.BufferGeometry();fg.setAttribute('position',new T.Float32BufferAttribute(flexPositions,3));fg.setAttribute('uv',new T.Float32BufferAttribute(flexUV,2));fg.setIndex(flexIndices);fg.computeVertexNormals();const displayFlex=add(display,fg,flex);
  for(const z of [.15,.75])solid(board,worldRounded([48.5,69.8],22,2,.3,z),z,.25,black,black);
  for(const x of [37.9,59.1])solid(board,worldRounded([x,69.8],.8,2,.1,.4),.4,.35,black,black);
  for(let i=0;i<13;i++)solid(board,worldRounded([40+i*1.3,69.6],.3,1.5,.05,.54),.54,.08,gold,gold);
  if(screenTexture)decal(display,variant.screen,-2.65,screenTexture);
  const housing=parts.get('housing');solid(housing,face,-4.5,2.8,cream,photo.get('housing'),[source.bezel,...source.sockets],.38);
  // Moulded mounting pads live behind the front skin, away from its apertures.
  for(const point of variant.mobile?[[50,381],[365,381],[48,744],[381,744]]:[[142,283],[543,255],[175,743],[643,694]]){
    cylinder(housing,point,-1.4,1.7,1.8,inside);cylinder(housing,point,.4,.9,.16,gold);cylinder(housing,point,.55,.45,.08,black);
  }
  for(const [a,b]of variant.mobile?[[[65,745],[360,745]],[[63,620],[356,620]]]:[[[210,750],[628,705]],[[236,583],[574,548]]])rib(housing,a,b,-1.6,.45,1.1,inside);
  const keys=parts.get('keys');for(const [i,path]of source.keys.entries()){
    const side=i===2?material('#a16d42',.38):brown,k=variant.keyPaths[i],d=variant.mobile?'M .15 .03 H .85 Q .96 .03 .96 .15 V .70 Q .96 .79 .85 .79 H .15 Q .04 .79 .04 .70 V .15 Q .04 .03 .15 .03 Z':[
      'M 228 608 L 307 597 Q 314 597 316 605 L 330 667 Q 331 674 325 675 L 247 686 Q 240 687 238 680 L 220 618 Q 218 611 228 608 Z',
      'M 363 591 L 445 582 Q 453 582 455 591 L 472 652 Q 474 660 467 662 L 383 673 Q 376 674 374 666 L 356 601 Q 354 593 363 591 Z',
      'M 489 579 L 575 566 Q 583 565 586 574 L 605 637 Q 607 646 599 648 L 515 660 Q 507 661 505 653 L 485 590 Q 482 582 489 579 Z'][i];
    const crown=sample(d,80,variant.mobile?p=>[k.x+p.x*k.w,k.y+p.y*k.h]:null);
    const p=keyCentres[i],shrink=(points,z0,z1,factor)=>points.map(q=>{const v=frame.unproject(q,z0);return frame.project([p[0]+(v[0]-p[0])*factor,p[1]+(v[1]-p[1])*factor,z1]);});
    const innerBack=shrink(path,-2.5,-2.5,.74),innerCrown=shrink(crown,-10,-8.5,.78);
    solid(keys,crown,-10,.1,side,photo.get('keys'));loft(keys,crown,path,-10,-2.5,photo.get('keys'),side);solid(keys,path,-2.5,.4,side,side,[innerBack]);
    loft(keys,innerBack,innerCrown,-2.5,-8.5,side,side);solid(keys,innerCrown,-8.5,.6,side,side);
    const socket=solid(keys,worldRounded(p,5.2,5.2,.6,-8),-8,5.7,side,side,[cross(p,2.2,.7,-8)]);mountPairs.push({a:socket,b:stems[i]});
    for(const [a,b]of [[[2.6,0],[7,0]],[[-2.6,0],[-7,0]],[[0,2.6],[0,7]],[[0,-2.6],[0,-7]]])rib(keys,frame.project([p[0]+a[0],p[1]+a[1],-7.8]),frame.project([p[0]+b[0],p[1]+b[1],-7.8]),-7.8,.45,4.3,side);
    if(labelTextures?.[i]){const faces=[[[24,22],[112,10],[133,83],[41,96]],[[26,21],[116,11],[139,81],[43,94]],[[24,21],[114,10],[137,81],[40,94]]];const k=variant.keyPaths[i],quad=variant.mobile?[[k.x+7,k.y+7],[k.x+91,k.y+7],[k.x+91,k.y+81],[k.x+7,k.y+81]]:faces[i].map(([x,y])=>[x+k.x,y+k.y]);decal(keys,quad,-10.05,labelTextures[i]);}
  }
  // Each independently rotatable assembly keeps its own physical pivot.
  function batchSurfaces(group){
    const batches=new Map(),position=new T.Vector3(),normal=new T.Vector3();
    for(const mesh of [...group.children]){if(!mesh.isMesh)continue;mesh.updateMatrix();const source=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry,p=source.getAttribute('position'),n=source.getAttribute('normal'),uv=source.getAttribute('uv'),normalMatrix=new T.Matrix3().getNormalMatrix(mesh.matrix),groups=source.groups.length?source.groups:[{start:0,count:p.count,materialIndex:0}];
      for(const section of groups){const material=Array.isArray(mesh.material)?mesh.material[section.materialIndex]:mesh.material;if(!batches.has(material))batches.set(material,{position:[],normal:[],uv:[]});const batch=batches.get(material);
        for(let i=section.start;i<Math.min(p.count,section.start+section.count);i++){position.fromBufferAttribute(p,i).applyMatrix4(mesh.matrix);normal.fromBufferAttribute(n,i).applyMatrix3(normalMatrix).normalize();batch.position.push(...position.toArray());batch.normal.push(...normal.toArray());batch.uv.push(uv?uv.getX(i):0,uv?uv.getY(i):0);}
      }
      if(source!==mesh.geometry)source.dispose();mesh.visible=false;mesh.userData.constructionOnly=true;
    }
    for(const [material,batch]of batches){const geometry=new T.BufferGeometry();for(const name of ['position','normal','uv'])geometry.setAttribute(name,new T.Float32BufferAttribute(batch[name],name==='uv'?2:3));const mesh=add(group,geometry,material);mesh.userData.batched=true;}
    group.userData.surfaceBatches=batches.size;
  }
  for(const group of parts.values()){
    group.updateMatrixWorld(true);const pivot=new T.Box3().setFromObject(group).getCenter(new T.Vector3());for(const mesh of group.children)mesh.position.sub(pivot);group.position.copy(pivot);group.userData.pivot=pivot.clone();
    batchSurfaces(group);
    group.traverse(mesh=>{if(mesh.isMesh)mesh.userData.partId=group.name;});
  }
  return {root,parts,source,depth,mountPairs,boardMountPairs,boardBase,displayCarrier,displayFlex,dispose(){for(const resource of new Set(resources))resource.dispose?.();}};
}
