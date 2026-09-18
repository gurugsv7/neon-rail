// Stages the MediaPipe runtime that the camera controls need.
//
// Every file here is an unmodified upstream release -- the WASM ships in the
// npm package, the two models come from Google's model host -- so they are
// fetched rather than committed, the same way the Kenney kits are. The build
// runs this automatically (npm's `prebuild` hook); run it directly with:
//
//   npm run assets:mediapipe
//
// The WASM loader is copied to a .wasmjs extension on purpose: esbuild has to
// inline it as base64 bytes for a blob URL, not parse it as a module.
import {copyFileSync, mkdirSync, existsSync, writeFileSync, statSync} from 'node:fs';
import {dirname, resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'assets/mediapipe');
const wasm = join(root, 'node_modules/@mediapipe/tasks-vision/wasm');

const MODELS = {
  // Head-only mode.
  'blaze_face_short_range.tflite':
    'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite',
  // Full-body mode. Lite rather than Full: measured at ~20 ms a frame, which
  // is the budget that leaves the renderer its 60 fps.
  'pose_landmarker_lite.task':
    'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
};

mkdirSync(out, {recursive: true});

if (!existsSync(wasm)) {
  throw new Error('@mediapipe/tasks-vision is not installed. Run: npm install');
}
for (const [from, to] of [
  ['vision_wasm_internal.wasm', 'vision_wasm_internal.wasm'],
  ['vision_wasm_internal.js', 'vision_wasm_internal.wasmjs'],
]) {
  const dest = join(out, to);
  if (!existsSync(dest)) copyFileSync(join(wasm, from), dest);
}

for (const [name, url] of Object.entries(MODELS)) {
  const dest = join(out, name);
  if (existsSync(dest)) continue;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${name}: download failed, ${res.status} ${res.statusText}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

for (const f of ['vision_wasm_internal.wasm', 'vision_wasm_internal.wasmjs', ...Object.keys(MODELS)]) {
  console.log(String(Math.round(statSync(join(out, f)).size / 1024)).padStart(7), 'KB ', f);
}
