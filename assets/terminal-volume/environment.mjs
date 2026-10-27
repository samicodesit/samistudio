export async function loadEnvironment(T,renderer){
 try{
  const response=await fetch('/assets/terminal-volume/studio-environment.bin.gz');if(!response.ok)throw Error('Environment unavailable');let buffer=await response.arrayBuffer();const bytes=new Uint8Array(buffer);
  if(bytes[0]===0x1f&&bytes[1]===0x8b)buffer=await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  const header=new Uint32Array(buffer,0,4),width=header[1],height=header[2];if(header[0]!==0x53544556||header[3]!==1||width>2048||height>2048||buffer.byteLength!==16+width*height*8)throw Error('Invalid environment');
  const texture=new T.DataTexture(new Uint16Array(buffer,16),width,height,T.RGBAFormat,T.HalfFloatType);texture.mapping=T.CubeUVReflectionMapping;texture.colorSpace=T.LinearSRGBColorSpace;texture.minFilter=T.LinearFilter;texture.magFilter=T.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
  return {texture,mode:'prebaked',dispose(){texture.dispose();}};
 }catch{
  const pmrem=new T.PMREMGenerator(renderer),room=new T.RoomEnvironment(),target=pmrem.fromScene(room,.04,.1,100,{size:128});room.dispose();pmrem.dispose();target.mode='generated';return target;
 }
}
