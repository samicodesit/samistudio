// Rebuild using the root's existing esbuild and the pinned construction package.
import {build} from 'esbuild';
import {copyFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=root+'design-assets/terminal-exploded/construction-3d/vendor/';
await mkdir(output,{recursive:true});
await build({stdin:{contents:`export * from './node_modules/three/build/three.module.js';
export {RoomEnvironment} from './node_modules/three/examples/jsm/environments/RoomEnvironment.js';`,resolveDir:root+'design-assets/terminal-exploded',loader:'js'},bundle:true,format:'esm',target:'es2022',minify:true,outfile:output+'terminal-three.mjs',legalComments:'eof'});
await copyFile(root+'design-assets/terminal-exploded/node_modules/three/LICENSE',output+'three-LICENSE.txt');
console.log('Bundled local terminal renderer and preserved Three.js license.');
