// Stages the MediaPipe runtime the motion control needs.
//
// These are unmodified upstream files -- the WASM comes from the npm package,
// the model from Google's model host -- so they are fetched rather than kept in
// the repo, the same way the Kenney kits and Mixamo FBX are. Run this once
// before building if outputs/neon-rail/assets/mediapipe is missing:
//
//   npm --prefix work/build install
//   node work/build/stage-mediapipe.mjs
//
// The wasm loader script is copied to a .wasmjs extension on purpose: esbuild
// must inline it as base64 bytes for a blob URL, not parse it as a module.
import {copyFileSync,mkdirSync,existsSync,writeFileSync,statSync} from 'node:fs';
import {resolve} from 'node:path';

const OUT=resolve('outputs/neon-rail/assets/mediapipe');
const WASM=resolve('work/build/node_modules/@mediapipe/tasks-vision/wasm');
const MODEL_URL='https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite';

mkdirSync(OUT,{recursive:true});
if(!existsSync(WASM))throw new Error('@mediapipe/tasks-vision is not installed. Run: npm --prefix work/build install');

copyFileSync(WASM+'/vision_wasm_internal.wasm',OUT+'/vision_wasm_internal.wasm');
copyFileSync(WASM+'/vision_wasm_internal.js',OUT+'/vision_wasm_internal.wasmjs');

const model=OUT+'/blaze_face_short_range.tflite';
if(!existsSync(model)){
  const res=await fetch(MODEL_URL);
  if(!res.ok)throw new Error(`model download failed: ${res.status} ${res.statusText}`);
  writeFileSync(model,Buffer.from(await res.arrayBuffer()));
}
for(const f of ['vision_wasm_internal.wasm','vision_wasm_internal.wasmjs','blaze_face_short_range.tflite'])
  console.log(String(Math.round(statSync(OUT+'/'+f).size/1024)).padStart(6),'KB ',f);
