import {createBodySignal} from './body-signal.js';
import {prepareTracker,requestHead,attachStream,onHeadFromStream,closeTracker} from './motion-tracker.js';
import {createMotionSignal} from './motion-signal.js';

export function createMotionControl(game,ui){
  const video=document.createElement('video');video.playsInline=true;video.muted=true;
  let stream=null,timer=null,signal=null,active=false,starting=false,streaming=false;
  let mode='body',body=createBodySignal(),bodyRunning=false,bodyReady=false,bodySeen=0;
  let status='off',lastHead=null,generation=0,lastSeen=0,calibration=[],calibrationStart=0;
  const report=(next,detail)=>{status=next;ui?.(next,detail,lastHead);};
  const centreAgain=()=>{calibration=[];calibrationStart=0;signal?.recentre();body.reset();bodyReady=false;bodyRunning=false;};
  async function enable(){
    if(active||starting)return active;
    starting=true;const ticket=++generation;
    try{
      report('starting');game.awaitingCamera=true;
      const acquired=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},frameRate:{ideal:30,max:30},facingMode:'user'},audio:false});
      if(ticket!==generation){acquired.getTracks().forEach(t=>t.stop());return false;}
      stream=acquired;game.awaitingCamera=false;video.srcObject=stream;await video.play();
      if(ticket!==generation)return false;
      report('loading');await prepareTracker(mode);if(ticket!==generation)return false;
      signal=createMotionSignal();active=true;starting=false;lastSeen=0;centreAgain();
      onHeadFromStream((head,meta)=>{if(ticket===generation)onHead(head,meta);});
      streaming=attachStream(stream.getVideoTracks()[0],1000/(mode==='body'?18:24));
      stream.getVideoTracks()[0].addEventListener('ended',()=>{if(ticket===generation){if(mode==='body'&&game.state==='playing')game.pause();disable();report('error','unavailable');}},{once:true});
      report('calibrating');if(!streaming)timer=setInterval(step,1000/(mode==='body'?18:24));
      return true;
    }catch(err){if(ticket!==generation)return false;disable();report('error',err?.name==='NotAllowedError'?'denied':'unavailable');return false;}
  }
  function step(){if(active&&!document.hidden){const ticket=generation;requestHead(video,(head,meta)=>{if(ticket===generation)onHead(head,meta);});}}
  function onHead(head,meta){
    if(!active||document.hidden)return;
    const now=performance.now();lastHead=head;
    if(meta?.capturedAt&&performance.timeOrigin+now-meta.capturedAt>350)return;
    if(mode==='body'){
      const out=body.update(head?.points,now);bodyRunning=out.running;bodyReady=!!out.ready;bodySeen=now;report(out.guide,out);
      if(out.ready){for(const intent of out.intents){if(intent.type==='lane')game.steer(intent.direction);else if(intent.type==='jump')game.hop();else if(intent.type==='duck')game.crouch();}
      if(out.posture==='duck'&&game.accepting()&&game.player.grounded&&game.player.slide<.18)game.player.duck();}return;
    }
    if(!head){signal.update(null,now);if(now-lastSeen>900){centreAgain();report('searching');}return;}
    if(lastSeen&&now-lastSeen>900)centreAgain();lastSeen=now;
    if(!signal.calibrated){
      if(!calibrationStart)calibrationStart=now;
      calibration.push(head);if(calibration.length>24)calibration.shift();
      const mean=calibration.reduce((a,h)=>({x:a.x+h.x,y:a.y+h.y,unit:a.unit+h.unit}),{x:0,y:0,unit:0});
      for(const k in mean)mean[k]/=calibration.length;
      const spread=Math.max(...calibration.map(h=>Math.hypot(h.x-mean.x,h.y-mean.y)))/mean.unit;
      if(spread>.16){calibration=[head];calibrationStart=now;}
      else if(now-calibrationStart>=850&&calibration.length>=8){signal.calibrate({...head,...mean});calibration=[];}
      report('calibrating');return;
    }
    const out=signal.update(head,now);report('tracking');
    // Head steering is positional, so drive the player toward the lane the head
    // is indicating rather than replaying a one-shot step. One lane per sample:
    // crossing two lanes takes a single lean and lands inside ~180 ms, and a
    // step the game refused -- mid-stumble, say -- corrects on the next sample
    // instead of being lost.
    if(game.accepting()&&game.player.lane!==out.lane)game.steer(Math.sign(out.lane-game.player.lane));
    for(const intent of out.intents){if(intent.type==='jump')game.hop();else if(intent.type==='duck')game.crouch();}
    // Sustain a held crouch without replaying its sound on every sample.
    if(out.posture==='duck'&&game.accepting()&&game.player.grounded&&game.player.slide<.18)game.player.duck();
  }
  function recalibrate(){if(active){centreAgain();report('calibrating');}}
  function disable(){
    generation++;bodyReady=false;bodyRunning=false;body.reset();starting=false;active=false;game.awaitingCamera=false;
    if(timer)clearInterval(timer);timer=null;
    onHeadFromStream(null);closeTracker();
    if(stream)stream.getTracks().forEach(t=>t.stop());
    stream=null;video.srcObject=null;streaming=false;signal=null;lastHead=null;report('off');
  }
  return {enable,disable,recalibrate,video,get mode(){return mode;},get requiresJog(){return mode==='body'&&(active||starting);},get tracked(){return bodyReady&&performance.now()-bodySeen<700;},get running(){return bodyRunning&&performance.now()-bodySeen<700;},async setMode(next){if(!['body','head'].includes(next)||next===mode)return;const restart=active||starting;disable();mode=next;if(restart)await enable();},get active(){return active;},get status(){return status;},get streaming(){return streaming;},toggle(){return active||starting?(disable(),false):enable();},dispose:disable};
}
