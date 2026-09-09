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
  constructor(minCutoff=1,beta=.004,dCutoff=1){
    this.minCutoff=minCutoff;this.beta=beta;this.dCutoff=dCutoff;
    this.x=null;this.dx=0;this.t=null;
  }
  static alpha(cutoff,dt){const tau=1/(2*Math.PI*cutoff);return 1/(1+tau/dt);}
  filter(value,t){
    if(this.x===null){this.x=value;this.t=t;return value;}
    const dt=Math.max(1e-3,(t-this.t)/1000);this.t=t;
    const dx=(value-this.x)/dt;
    this.dx+=OneEuro.alpha(this.dCutoff,dt)*(dx-this.dx);
    const cutoff=this.minCutoff+this.beta*Math.abs(this.dx);
    this.x+=OneEuro.alpha(cutoff,dt)*(value-this.x);
    return this.x;
  }
  reset(){this.x=null;this.dx=0;this.t=null;}
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
  };
}

export const MOTION_TUNING={
  // Fractions of the scale unit (head width), measured from the calibrated centre.
  enter:.32,exit:.20,        // entering a lane needs a bigger lean than holding it
  dwellMs:100,               // the lean must persist, so a twitch cannot steer
  cooldownMs:180,            // one deliberate lean must not fire twice
  jumpRise:.30,duckDrop:.34, // vertical, same unit
  verticalCooldownMs:420,
  recentre:.006,             // slow drift correction, only while centred
  lostMs:900,                // how long to coast before declaring tracking lost
};

export function createMotionSignal(tuning={}){
  const T={...MOTION_TUNING,...tuning};
  const fx=new OneEuro(1,.004,1),fy=new OneEuro(1,.004,1);
  const rawX=[],rawY=[];
  let centre=null,unit=null;            // calibration
  let lane=1,pending=null,pendingSince=0,lastLane=-1e9,lastVertical=-1e9;
  let lastSeen=0,offsetX=0,offsetY=0;

  function calibrate(sample){
    centre={x:sample.x,y:sample.y};unit=Math.max(1e-4,sample.unit);
    fx.reset();fy.reset();rawX.length=0;rawY.length=0;
    lane=1;pending=null;offsetX=0;offsetY=0;
  }

  // sample: {x,y,unit} already normalised so that +x is screen-right, and with
  // `unit` a scale that travels with the player (head width), which is what
  // makes the thresholds independent of how far away they are sitting.
  function update(sample,now){
    const intents=[];
    if(!sample){
      if(now-lastSeen>T.lostMs)pending=null;
      return {lane,offsetX,offsetY,tracking:now-lastSeen<=T.lostMs,intents};
    }
    lastSeen=now;
    if(!centre)calibrate(sample);

    rawX.push(sample.x);if(rawX.length>3)rawX.shift();
    rawY.push(sample.y);if(rawY.length>3)rawY.shift();
    const mx=rawX.length===3?median3(rawX[0],rawX[1],rawX[2]):sample.x;
    const my=rawY.length===3?median3(rawY[0],rawY[1],rawY[2]):sample.y;
    const sx=fx.filter(mx,now),sy=fy.filter(my,now);

    unit=unit+(sample.unit-unit)*.05;   // head width drifts as the player moves
    offsetX=(sx-centre.x)/unit;
    offsetY=(sy-centre.y)/unit;

    // Lane: asymmetric thresholds plus a dwell time. Hysteresis alone still
    // flickers when the underlying signal is noisy, so both are needed.
    const want=offsetX<-T.enter?0:offsetX>T.enter?2:
      (lane===0&&offsetX<-T.exit)?0:(lane===2&&offsetX>T.exit)?2:1;
    if(want!==lane){
      if(pending!==want){pending=want;pendingSince=now;}
      else if(now-pendingSince>=T.dwellMs&&now-lastLane>=T.cooldownMs){
        lane=want;lastLane=now;pending=null;intents.push({type:'lane',lane});
      }
    }else pending=null;

    // Vertical. Image y grows downward, so a rising head is a falling offset.
    if(now-lastVertical>=T.verticalCooldownMs){
      if(offsetY<-T.jumpRise){lastVertical=now;intents.push({type:'jump'});}
      else if(offsetY>T.duckDrop){lastVertical=now;intents.push({type:'duck'});}
    }

    // Players settle and drift over a session. Correct for it only while they
    // are centred -- doing it mid-lane would silently slide them back.
    if(lane===1&&Math.abs(offsetX)<T.exit){
      centre.x+=(sx-centre.x)*T.recentre;
      centre.y+=(sy-centre.y)*T.recentre;
    }
    return {lane,offsetX,offsetY,tracking:true,intents};
  }

  return {update,calibrate,recentre:()=>{centre=null;},
    get calibrated(){return !!centre;}};
}
