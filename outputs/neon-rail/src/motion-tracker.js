import poseModel from '../assets/mediapipe/pose_landmarker_lite.task';
import wasmBinary from '../assets/mediapipe/vision_wasm_internal.wasm';
import wasmLoader from '../assets/mediapipe/vision_wasm_internal.wasmjs';
import faceModel from '../assets/mediapipe/blaze_face_short_range.tflite';


// Camera resources load on demand; no model or WASM decoding at game startup.
let worker=null,ready=null,pending=null,busy=false,streamHandler=null,workerURL=null,rejectReady=null,epoch=0,lastVideoTime=-1;

export function prepareTracker(mode='head'){
  if(ready)return ready;
  ready=new Promise((resolve,reject)=>{
    rejectReady=reject;const ticket=epoch;worker=new Worker(new URL('dist/motion-worker.js',document.baseURI));
    worker.onmessage=event=>{
      const msg=event.data;
      if(msg.type==='ready'){rejectReady=null;resolve(true);}
      else if(msg.type==='failed'){ready=null;reject(new Error(msg.error));}
      else if(msg.type==='head'){
        if(pending){busy=false;const cb=pending;pending=null;cb(msg.head,msg);}
        else streamHandler&&streamHandler(msg.head,msg);
      }
    };
    worker.onerror=err=>{ready=null;reject(err);};
    Promise.all([wasmBinary,wasmLoader,mode==='body'?poseModel:faceModel].map(async url=>{const response=await fetch(url);if(!response.ok)throw Error('Camera asset failed: '+response.status);return new Uint8Array(await response.arrayBuffer());})).then(([wasm,loader,model])=>{
      if(ticket!==epoch)return;
      worker.postMessage({type:'init',wasm,loader,model,mode},[wasm.buffer,loader.buffer,model.buffer]);
    }).catch(error=>{if(ticket===epoch){ready=null;reject(error);}});
  });
  return ready;
}

// Frames are captured at CAPTURE_W x CAPTURE_H rather than the camera's native
// size. The model resizes to 128x128 internally either way -- detection was
// measured as 30/30 at this size -- but copying a quarter of the pixels off the
// main thread costs proportionally less.
const CAPTURE_W=320,CAPTURE_H=240;

// Sends one frame for detection. Returns false immediately if a frame is still
// in flight, so a slow inference throttles itself instead of queueing up.
export async function requestHead(source,onHead){
  if(!worker||busy)return false;
  const w=source&&(source.videoWidth||source.width),h=source&&(source.videoHeight||source.height);
  if(!w||!h)return false;
  if(typeof source.currentTime==='number'&&source.currentTime===lastVideoTime)return false;
  const ticket=epoch,capturedAt=Date.now();busy=true;
  if(typeof source.currentTime==='number')lastVideoTime=source.currentTime;
  let bitmap;
  try{
    // createImageBitmap resizes on its own, which avoids a synchronous canvas
    // draw on the main thread. The model works to 128x128 internally anyway --
    // detection measured 30/30 at this size.
    bitmap=await createImageBitmap(source,
      {resizeWidth:CAPTURE_W,resizeHeight:CAPTURE_H,resizeQuality:'low'});
  }catch{if(ticket===epoch)busy=false;return false;}
  if(ticket!==epoch||!worker){bitmap.close();return false;}
  pending=onHead;
  try{worker.postMessage({type:'frame',bitmap,t:performance.now(),capturedAt},[bitmap]);}
  catch{bitmap.close();busy=false;pending=null;return false;}
  return true;
}

// Hands the camera track to the worker so it can pull its own frames. Returns
// false where MediaStreamTrackProcessor is missing (Firefox), leaving the
// requestHead path as the fallback.
export function attachStream(track,intervalMs){
  if(typeof MediaStreamTrackProcessor==='undefined'||!worker)return false;
  try{
    const processor=new MediaStreamTrackProcessor({track});
    worker.postMessage({type:'stream',readable:processor.readable,intervalMs},[processor.readable]);
    return true;
  }catch{return false;}
}

export function onHeadFromStream(fn){streamHandler=fn;}

export function closeTracker(){
  epoch++;rejectReady?.(new Error('Tracker closed'));rejectReady=null;
  try{worker?.terminate();}catch{}
  if(workerURL)URL.revokeObjectURL(workerURL);workerURL=null;
  worker=null;ready=null;pending=null;busy=false;streamHandler=null;lastVideoTime=-1;
}
