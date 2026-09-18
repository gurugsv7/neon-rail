import {FaceDetector,PoseLandmarker} from '@mediapipe/tasks-vision';
import {selectHead} from './motion-signal.js';

// Face detection runs here rather than on the main thread. One inference costs
// ~7ms; against a 15ms render that is a dropped frame every time it fires, and
// at 12Hz that was measured as 19 long frames a second -- visible stutter. The
// runtime bytes arrive by postMessage so the 11MB WASM is not duplicated into
// this bundle as well.
let detector=null,mode='head';
let previous=null,lastSeen=0,cost=8,activeUntil=0;
function detect(image,t,width,height){
  const start=performance.now();if(t-lastSeen>900)previous=null;
  const result=detector.detectForVideo(image,t);
  if(mode==='body'){cost+=(Math.min(180,performance.now()-start)-cost)*.15;return result.landmarks?.[0]?{points:result.landmarks[0]}:null;}
  const head=selectHead(result?.detections,width,height,previous);
  cost+=(performance.now()-start-cost)*.15;
  if(head){if(previous&&Math.hypot(head.x-previous.x,head.y-previous.y)/head.unit>.025)activeUntil=t+450;previous=head;lastSeen=t;}
  return head;
}
const CAPTURE_W=320,CAPTURE_H=240;

self.onmessage=async event=>{
  const msg=event.data;
  if(msg.type==='init'){
    try{
      const url=(bytes,type)=>URL.createObjectURL(new Blob([bytes],{type}));
      mode=msg.mode||'head';
      const files={wasmLoaderPath:url(msg.loader,'text/javascript'),wasmBinaryPath:url(msg.wasm,'application/wasm')};
      const options={baseOptions:{modelAssetBuffer:msg.model,delegate:'CPU'},runningMode:'VIDEO',...(mode==='body'?{numPoses:1,minPoseDetectionConfidence:.6,minPosePresenceConfidence:.6,minTrackingConfidence:.6,outputSegmentationMasks:false}:{minDetectionConfidence:.5})};
      if(mode==='body'){
        try{detector=await PoseLandmarker.createFromOptions(files,{...options,canvas:new OffscreenCanvas(256,256),baseOptions:{...options.baseOptions,delegate:'GPU'}});}
        catch{detector=await PoseLandmarker.createFromOptions(files,options);}
      }else detector=await FaceDetector.createFromOptions(files,options);
      self.postMessage({type:'ready'});
    }catch(err){self.postMessage({type:'failed',error:String(err&&err.message||err)});}
    return;
  }
  if(msg.type==='frame'){
    let head=null;
    if(detector){
      try{
        head=detect(msg.bitmap,msg.t,msg.bitmap.width,msg.bitmap.height);
      }catch{}
    }
    msg.bitmap.close();
    self.postMessage({type:'head',head,capturedAt:msg.capturedAt,inferenceMs:cost});
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
    next=now+Math.max(mode==='body'?1000/18:now<activeUntil?intervalMs:1000/12,cost*(mode==='body'?1.25:4));
    let head=null;
    try{
      paint.drawImage(frame,0,0,CAPTURE_W,CAPTURE_H);
      frame.close();
      head=detect(surface,now,CAPTURE_W,CAPTURE_H);
    }catch{try{frame.close();}catch{}}
    self.postMessage({type:'head',head,capturedAt:performance.timeOrigin+now,inferenceMs:cost});
  }
}
