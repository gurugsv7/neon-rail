import wasmBinary from '../assets/mediapipe/vision_wasm_internal.wasm';
import wasmLoader from '../assets/mediapipe/vision_wasm_internal.wasmjs';
import faceModel from '../assets/mediapipe/blaze_face_short_range.tflite';
import workerCode from '../assets/mediapipe/motion-worker.workerjs';

// Main-thread half of the face tracker. It owns no MediaPipe code at all: the
// runtime is inlined here as base64 and handed to a worker, which does the
// inference. Detection blocked the main thread for ~7ms per call, which against
// a 15ms render measured as 19 dropped frames a second at 12Hz.
//
// The documented way to load MediaPipe fetches its runtime from a CDN. This
// game is a single offline file verified to make zero network requests, so the
// bytes travel by postMessage and the worker builds blob URLs from them; a
// WasmFileset is only a pair of URL strings, and nothing requires them remote.
const decode=b64=>Uint8Array.from(atob(b64),c=>c.charCodeAt(0));

let worker=null,ready=null,pending=null,busy=false,streamHandler=null;

export function prepareTracker(){
  if(ready)return ready;
  ready=new Promise((resolve,reject)=>{
    worker=new Worker(URL.createObjectURL(new Blob([decode(workerCode)],{type:'text/javascript'})));
    worker.onmessage=event=>{
      const msg=event.data;
      if(msg.type==='ready')resolve(true);
      else if(msg.type==='failed'){ready=null;reject(new Error(msg.error));}
      else if(msg.type==='head'){
        if(pending){busy=false;const cb=pending;pending=null;cb(msg.head);}
        else streamHandler&&streamHandler(msg.head);
      }
    };
    worker.onerror=err=>{ready=null;reject(err);};
    const wasm=decode(wasmBinary),loader=decode(wasmLoader),model=decode(faceModel);
    // Transferred, not copied: these are 11MB and would otherwise be duplicated.
    worker.postMessage({type:'init',wasm,loader,model},[wasm.buffer,loader.buffer,model.buffer]);
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
  let bitmap;
  try{
    // createImageBitmap resizes on its own, which avoids a synchronous canvas
    // draw on the main thread. The model works to 128x128 internally anyway --
    // detection measured 30/30 at this size.
    bitmap=await createImageBitmap(source,
      {resizeWidth:CAPTURE_W,resizeHeight:CAPTURE_H,resizeQuality:'low'});
  }catch{return false;}
  busy=true;pending=onHead;
  worker.postMessage({type:'frame',bitmap,t:performance.now()},[bitmap]);
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
  try{worker?.terminate();}catch{}
  worker=null;ready=null;pending=null;busy=false;streamHandler=null;
}
