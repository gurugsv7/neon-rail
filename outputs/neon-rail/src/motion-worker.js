import {FaceDetector} from '@mediapipe/tasks-vision';
import {normaliseHead} from './motion-signal.js';

// Face detection runs here rather than on the main thread. One inference costs
// ~7ms; against a 15ms render that is a dropped frame every time it fires, and
// at 12Hz that was measured as 19 long frames a second -- visible stutter. The
// runtime bytes arrive by postMessage so the 11MB WASM is not duplicated into
// this bundle as well.
let detector=null;
const CAPTURE_W=320,CAPTURE_H=240;

self.onmessage=async event=>{
  const msg=event.data;
  if(msg.type==='init'){
    try{
      const url=(bytes,type)=>URL.createObjectURL(new Blob([bytes],{type}));
      detector=await FaceDetector.createFromOptions({
        wasmLoaderPath:url(msg.loader,'text/javascript'),
        wasmBinaryPath:url(msg.wasm,'application/wasm'),
      },{
        baseOptions:{modelAssetBuffer:msg.model,delegate:'CPU'},
        runningMode:'VIDEO',minDetectionConfidence:.5,numFaces:1,
      });
      self.postMessage({type:'ready'});
    }catch(err){self.postMessage({type:'failed',error:String(err&&err.message||err)});}
    return;
  }
  if(msg.type==='frame'){
    let head=null;
    if(detector){
      try{
        const result=detector.detectForVideo(msg.bitmap,msg.t);
        head=normaliseHead(result?.detections?.[0]?.boundingBox,msg.bitmap.width,msg.bitmap.height);
      }catch{}
    }
    msg.bitmap.close();
    self.postMessage({type:'head',head});
    return;
  }
  if(msg.type==='stream'){
    // Pulling frames straight off the track means the main thread does no
    // capture work at all. Grabbing one frame there cost 2.5ms, which was
    // enough to push an otherwise-on-time 16ms frame past vsync.
    consume(msg.readable,msg.intervalMs);
  }
};

async function consume(readable,intervalMs){
  const reader=readable.getReader();
  const surface=new OffscreenCanvas(CAPTURE_W,CAPTURE_H);
  const paint=surface.getContext('2d',{alpha:false});
  let next=0;
  for(;;){
    const {value:frame,done}=await reader.read();
    if(done)return;
    const now=performance.now();
    // Frames arrive at camera rate; only a fraction are worth detecting on.
    if(!detector||now<next){frame.close();continue;}
    next=now+intervalMs;
    let head=null;
    try{
      paint.drawImage(frame,0,0,CAPTURE_W,CAPTURE_H);
      frame.close();
      const result=detector.detectForVideo(surface,now);
      head=normaliseHead(result?.detections?.[0]?.boundingBox,CAPTURE_W,CAPTURE_H);
    }catch{try{frame.close();}catch{}}
    self.postMessage({type:'head',head});
  }
}
