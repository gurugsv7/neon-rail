// Turns a noisy per-frame estimate of where the player's head is into steady
// lane / jump / duck commands.
//
// Deliberately knows nothing about cameras or ML: it takes a normalised point
// and a scale unit, and emits discrete intents. That keeps the tracker
// swappable and lets this be tested on synthetic input with no webcam.

// One Euro Filter (Casiez, Roussel & Vogel, CHI 2012). A plain low-pass filter
// forces a choice between jitter while still and lag while moving; this one
// raises its cutoff with speed, so it is calm at rest and responsive on a
// deliberate lean, which is exactly the trade-off a lean-to-steer control needs.
class OneEuro{
  constructor(minCutoff=1.7,beta=8,dCutoff=1.5){
    this.minCutoff=minCutoff;this.beta=beta;this.dCutoff=dCutoff;
    this.x=null;this.raw=null;this.dx=0;this.t=null;
  }
  static alpha(cutoff,dt){const tau=1/(2*Math.PI*cutoff);return 1/(1+tau/dt);}
  filter(value,t){
    if(this.x===null){this.x=this.raw=value;this.t=t;return value;}
    const dt=Math.max(1e-3,Math.min(.2,(t-this.t)/1000));this.t=t;
    const dx=(value-this.raw)/dt;this.raw=value;
    this.dx+=OneEuro.alpha(this.dCutoff,dt)*(dx-this.dx);
    const cutoff=this.minCutoff+this.beta*Math.abs(this.dx);
    this.x+=OneEuro.alpha(cutoff,dt)*(value-this.x);
    return this.x;
  }
  reset(){this.x=null;this.raw=null;this.dx=0;this.t=null;}
}

// A single bad detection frame shows up as a spike; a median of three removes it
// without adding the lag a longer window would.
function median3(a,b,c){return Math.max(Math.min(a,b),Math.min(Math.max(a,b),c));}

// The raw camera image is not mirrored: a player moving to their OWN left
// travels toward increasing x in it, the way a person facing you moves to your
// right. The game wants their own left to be the screen-left lane, so x is
// flipped here, once, and nowhere else. Getting this wrong is the classic
// webcam-control bug because it still looks plausible on screen.
export function normaliseHead(box,width,height){
  if(!box||!width||!height)return null;
  return {
    x:1-(box.originX+box.width/2)/width,
    y:(box.originY+box.height/2)/height,
    // Head width travels with the player, so thresholds in these units hold
    // whether they sit near the camera or far from it.
    unit:Math.max(.04,box.width/width),
    aspect:width/height,
    height:box.height/height,
  };
}

// Where to draw the tracking box on the mirrored self-view.
//
// head.x is ALREADY mirrored -- it is the position as the player sees
// themselves -- and the preview draws the video mirrored too, so the box goes
// straight at head.x. Flipping it again here put the box on the opposite side
// of the face from the player, which reads as broken tracking even though the
// steering underneath was correct.
export function previewBox(head,width,height){
  if(!head)return null;
  const size=head.unit*width;
  const h=head.height?head.height*height:size*1.2;
  return {x:head.x*width-size/2, y:head.y*height-h/2, w:size, h};
}

export const MOTION_TUNING={
  // Fractions of the scale unit (head width), measured from the calibrated centre.
  enter:.32,exit:.20,        // entering a lane needs a bigger lean than holding it
  dwellMs:55,                // two confirmed samples at the active capture rate
  cooldownMs:130,
  jumpRise:.30,duckDrop:.34, // vertical, same unit
  verticalCooldownMs:420,
  recentre:.006,             // slow drift correction, only while centred
  lostMs:900,                // how long to coast before declaring tracking lost
  verticalRelease:.14,
  verticalDwellMs:45,
};

export function selectHead(detections,width,height,previous){
  let best=null,bestCost=Infinity;
  for(const d of detections||[]){
    const confidence=d.categories?.[0]?.score??1;
    if(confidence<.6)continue;
    const h=normaliseHead(d.boundingBox,width,height);if(!h)continue;
    const distance=previous?Math.hypot(h.x-previous.x,h.y-previous.y)/previous.unit:0;
    if(previous&&distance>2.5)continue;
    const cost=previous?distance+(1-confidence)*.3:(1-confidence)-h.unit*.2;
    if(cost<bestCost){bestCost=cost;best={...h,confidence};}
  }
  return best;
}

export function createMotionSignal(tuning={}){
  const T={...MOTION_TUNING,...tuning};
  const fx=new OneEuro(),fy=new OneEuro(2,8,1.5);
  const rawX=[],rawY=[];
  let centre=null,unit=null;            // calibration
  let armed=true;
  let lane=1,pending=null,pendingSince=0,lastLane=-1e9,lastVertical=-1e9;
  let lastSeen=-Infinity,lastTime=null,offsetX=0,offsetY=0;
  let posture='neutral',verticalPending=null,verticalSince=0,neutralSince=null;

  function calibrate(sample){
    centre={x:sample.x,y:sample.y};unit=Math.max(1e-4,sample.unit);
    fx.reset();fy.reset();rawX.length=0;rawY.length=0;
    lane=1;armed=true;pending=null;offsetX=0;offsetY=0;lastTime=null;
    lastLane=lastVertical=-1e9;posture='neutral';verticalPending=null;neutralSince=null;
  }

  // sample: {x,y,unit} already normalised so that +x is screen-right, and with
  // `unit` a scale that travels with the player (head width), which is what
  // makes the thresholds independent of how far away they are sitting.
  function update(sample,now){
    const intents=[];
    if(!sample||!Number.isFinite(sample.x)||!Number.isFinite(sample.y)||!Number.isFinite(sample.unit)||sample.unit<=0||sample.confidence<.6){
      pending=null;verticalPending=null;
      if(now-lastSeen>T.lostMs)pending=null;
      return {lane,offsetX,offsetY,posture:'neutral',tracking:now-lastSeen<=T.lostMs,intents};
    }
    if(centre&&now-lastSeen>T.lostMs&&lastSeen!==-Infinity){calibrate(sample);lastSeen=now;return {lane,offsetX,offsetY,posture,tracking:true,intents};}
    lastSeen=now;
    if(!centre)calibrate(sample);
    const dt=lastTime===null?1/18:Math.min(.2,Math.max(.001,(now-lastTime)/1000));lastTime=now;

    rawX.push(sample.x);if(rawX.length>3)rawX.shift();
    rawY.push(sample.y);if(rawY.length>3)rawY.shift();
    const mx=rawX.length===3?median3(rawX[0],rawX[1],rawX[2]):sample.x;
    const my=rawY.length===3?median3(rawY[0],rawY[1],rawY[2]):sample.y;
    const sx=fx.filter(mx,now),sy=fy.filter(my,now);

    unit+=(Math.max(unit*.8,Math.min(unit*1.2,sample.unit))-unit)*(1-Math.exp(-.65*dt));
    offsetX=(sx-centre.x)/unit;
    offsetY=(sy-centre.y)/(unit*(sample.aspect||1));

    // Lane: asymmetric thresholds plus a dwell time. Hysteresis alone still
    // flickers when the underlying signal is noisy, so both are needed.
    const want=offsetX<-T.enter?0:offsetX>T.enter?2:
      (lane===0&&offsetX<-T.exit)?0:(lane===2&&offsetX>T.exit)?2:1;
    if(want!==lane){
      if(pending!==want){pending=want;pendingSince=now;}
      else if(now-pendingSince>=T.dwellMs&&now-lastLane>=T.cooldownMs){
        lane=want;lastLane=now;pending=null;
        if(lane===1)armed=true;
        else if(armed){armed=false;intents.push({type:'lane',direction:lane===0?-1:1,lane});}
      }
    }else pending=null;

    // Vertical. Image y grows downward, so a rising head is a falling offset.
    // A pose fires once, then requires a deliberate return to neutral. Holding
    // the head high must never turn into automatic repeated jumps.
    if(Math.abs(offsetY)<T.verticalRelease){
      neutralSince??=now;if(now-neutralSince>=75)posture='neutral';
      verticalPending=null;
    }else{
      neutralSince=null;
      const wantVertical=offsetY<-T.jumpRise?'jump':offsetY>T.duckDrop?'duck':null;
      if(posture==='neutral'&&wantVertical&&now-lastVertical>=T.verticalCooldownMs){
        if(verticalPending!==wantVertical){verticalPending=wantVertical;verticalSince=now;}
        else if(now-verticalSince>=T.verticalDwellMs){posture=wantVertical;lastVertical=now;verticalPending=null;intents.push({type:posture});}
      }else verticalPending=null;
    }

    // Players settle and drift over a session. Correct for it only while they
    // are centred -- doing it mid-lane would silently slide them back.
    if(lane===1&&Math.abs(offsetX)<T.exit&&Math.abs(offsetY)<T.verticalRelease&&posture==='neutral'){
      const drift=1-Math.pow(1-T.recentre,dt*12);
      centre.x+=(sx-centre.x)*drift;
      centre.y+=(sy-centre.y)*drift;
    }
    return {lane,offsetX,offsetY,posture,tracking:true,intents};
  }

  return {update,calibrate,recentre:()=>{centre=null;},
    get calibrated(){return !!centre;}};
}
