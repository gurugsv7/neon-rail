import {build} from 'esbuild';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve('outputs/neon-rail');
// The detection worker is bundled first and inlined into the game as bytes:
// a single-file build cannot ship a separate worker script, so it is started
// from a blob URL at runtime. The WASM is not bundled in here -- it is passed
// across by postMessage so the 11MB payload exists only once.
const worker=await build({entryPoints:[root+'/src/motion-worker.js'],bundle:true,write:false,
  minify:true,format:'iife',target:['chrome110','edge110','firefox115'],
  nodePaths:[resolve('work/build/node_modules')]});
writeFileSync(root+'/assets/mediapipe/motion-worker.workerjs',worker.outputFiles[0].text);

const result=await build({entryPoints:[root+'/src/game.js'],bundle:true,write:false,minify:true,format:'iife',loader:{'.glb':'base64','.wasm':'base64','.wasmjs':'base64','.tflite':'base64','.workerjs':'base64'},target:['chrome110','edge110','firefox115'],nodePaths:[resolve('work/build/node_modules')],legalComments:'eof'});
let shell=readFileSync(root+'/src/shell.html','utf8');
shell=shell.replace('/*INLINE_CSS*/',readFileSync(root+'/src/style.css','utf8')).replace('/*INLINE_JS*/',()=>result.outputFiles[0].text.replaceAll('</script','<\\/script'));
writeFileSync(root+'/NEON RAIL.html',shell);
copyFileSync('work/build/node_modules/three/LICENSE',root+'/THREE-LICENSE.txt');
console.log('Built offline game:',root+'/NEON RAIL.html',Math.round(shell.length/1024)+' KB');
