import {prepareTracker,requestHead,attachStream,onHeadFromStream,closeTracker} from './motion-tracker.js';
import {createMotionSignal} from './motion-signal.js';

// Camera steering: owns the webcam, runs detection on a throttled loop, and
// turns what it sees into the same lane/jump/duck calls the keyboard makes.
//
// Detection runs at DETECT_HZ, not per frame. One inference costs ~8ms, which
// would eat half the 16.7ms frame budget if it ran every frame; a lane change
// is a deliberate gesture that nobody performs in under ~150ms, so sampling at
// 12Hz loses nothing and costs under a tenth of the CPU.
const DETECT_HZ=12;

export function createMotionControl(game,ui){
  const video=document.createElement('video');
  video.playsInline=true;video.muted=true;
  let stream=null,timer=null,signal=null,active=false,streaming=false;
  let status='off',lastHead=null,calibrateUntil=0;

  // Called on every detection, not only when the status word changes: the
  // panel has a live self-view and a lane indicator to repaint, and gating this
  // on a status change froze the preview the moment tracking settled.
  function report(next,detail){
    status=next;
    ui?.(next,detail,lastHead);
  }

  async function enable(){
    if(active)return true;
    try{
      report('starting');
      // Asked for only on a deliberate click, never on load.
      // The browser's permission prompt takes focus, and the game pauses on
      // blur; flag it so agreeing to the camera does not stop the run.
      game.awaitingCamera=true;
      stream=await navigator.mediaDevices.getUserMedia({
        video:{width:{ideal:640},height:{ideal:480},facingMode:'user'},audio:false});
      game.awaitingCamera=false;
      video.srcObject=stream;await video.play();
      report('loading');
      await prepareTracker();
      signal=createMotionSignal();
      active=true;
      // Preferred path: the worker pulls frames itself, so nothing about
      // detection touches the main thread. Falls back to posting frames.
      onHeadFromStream(onHead);
      streaming=attachStream(stream.getVideoTracks()[0],1000/DETECT_HZ);
      // A short hold-still window sets the centre and the head-width unit, so
      // thresholds mean the same thing wherever the player is sitting.
      calibrateUntil=performance.now()+2200;
      signal.recentre();
      report('calibrating');
      if(!streaming)timer=setInterval(step,1000/DETECT_HZ);
      return true;
    }catch(err){
      game.awaitingCamera=false;
      disable();
      report('error',err&&err.name==='NotAllowedError'?'denied':'unavailable');
      return false;
    }
  }

  function step(){
    if(!active)return;
    // requestHead declines while a frame is still out, so a slow inference
    // throttles itself rather than building a backlog.
    requestHead(video,onHead);
  }

  function onHead(head){
    if(!active)return;
    const now=performance.now();
    lastHead=head;
    if(!head){report('searching');signal.update(null,now);return;}
    if(now<calibrateUntil){
      // Keep re-seating the centre while they hold still, so calibration ends
      // on where they actually settled.
      signal.calibrate(head);
      report('calibrating');
      return;
    }
    const out=signal.update(head,now);
    report('tracking');
    for(const intent of out.intents){
      if(intent.type==='lane')game.steerTo(intent.lane);
      else if(intent.type==='jump')game.hop();
      else if(intent.type==='duck')game.crouch();
    }
  }

  function recalibrate(){
    if(!active)return;
    signal.recentre();
    calibrateUntil=performance.now()+2200;
    report('calibrating');
  }

  function disable(){
    if(timer)clearInterval(timer);timer=null;
    if(stream)for(const track of stream.getTracks())track.stop();
    stream=null;video.srcObject=null;active=false;streaming=false;signal=null;lastHead=null;
    report('off');
  }

  return {enable,disable,recalibrate,video,
    get active(){return active;},get status(){return status;},get streaming(){return streaming;},
    toggle(){return active?(disable(),false):enable();},
    dispose(){disable();closeTracker();}};
}
