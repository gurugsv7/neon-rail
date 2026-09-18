import assert from 'node:assert/strict';
import {createMotionSignal,normaliseHead,selectHead,previewBox} from '../src/motion-signal.js';
const centre={x:.5,y:.5,unit:.16};
function harness(hz=24){let t=1000;const s=createMotionSignal(),events=[];return {s,events,get time(){return t;},feed(sample,n=1){let out;for(let i=0;i<n;i++){out=s.update(sample,t);events.push(...out.intents.map(e=>({...e,t})));t+=1000/hz;}return out;}};}
const measurements=[];
for(const hz of [12,24,30]){
  const h=harness(hz);h.feed(centre,hz);const start=h.time;
  h.feed({...centre,x:.5-.16*.55},hz);
  const lane=h.events.find(e=>e.type==='lane');assert.equal(lane.lane,0);
  assert(lane.t-start<=270,`steering too slow at ${hz}Hz`);measurements.push({hz,latencyMs:Math.round(lane.t-start)});
  const count=h.events.length;h.feed({...centre,x:.5-.16*.55},hz*3);assert.equal(h.events.length,count,'a held lean must not repeat');
  // Positional, so centring the head is itself an instruction: go back to the
  // middle lane. The gesture model used to ignore it.
  h.feed(centre,hz);assert.equal(h.events.at(-1).lane,1,'centring must return to the middle lane');
  h.feed({...centre,x:.5-.16*.55},hz);assert.equal(h.events.at(-1).lane,0,'leaning again must reach the left lane');
}
for(const kind of ['jump','duck']){
  const h=harness();h.feed(centre,24);const pose={...centre,y:.5+(kind==='jump'?-.09:.09)};
  h.feed(pose,96);assert.equal(h.events.filter(e=>e.type===kind).length,1,'held pose must fire once');
  h.feed(centre,24);h.feed(pose,24);assert.equal(h.events.filter(e=>e.type===kind).length,2,'neutral must rearm');
}
// Vertical reach and latency. In this harness a sample carries no aspect, so
// one head-width of vertical offset is 0.16 of frame height: the movements
// below sit above the new thresholds (0.20 rise, 0.24 drop) and under the old
// ones (0.30 and 0.34), which is exactly the range that used to do nothing.
const vertical=[];
for(const [kind,dy] of [['jump',-.040],['duck',.045]]){
  const h=harness();h.feed(centre,24);const start=h.time;
  h.feed({...centre,y:.5+dy},24);
  const fired=h.events.find(e=>e.type===kind);
  assert(fired,`a modest ${kind} movement must register`);
  assert(fired.t-start<=210,`${kind} too slow: ${fired.t-start}ms`);
  vertical.push({kind,reachHeadWidths:+Math.abs(dy/.16).toFixed(2),latencyMs:Math.round(fired.t-start)});
}

// A hard lean rocks the head down on its way over. That transient must not
// read as a slide, or steering and sliding fight each other.
const rock=harness();rock.feed(centre,24);
for(let i=0;i<4;i++)rock.feed({...centre,x:.5-.16*.55,y:.5+.050});
rock.feed({...centre,x:.5-.16*.55},24);
assert.equal(rock.events.filter(e=>e.type==='duck').length,0,'a hard lean must not read as a slide');
assert(rock.events.some(e=>e.type==='lane'),'the lean must still steer');

const noisy=harness();noisy.feed(centre,24);
for(let i=0;i<240;i++)noisy.feed({...centre,x:.5+Math.sin(i*1.9)*.008,y:.5+Math.cos(i*2.1)*.006});
noisy.feed({...centre,x:.1,y:.1});noisy.feed(centre,24);assert.equal(noisy.events.length,0,'noise or spike fired');
const lost=harness();lost.feed(centre,24);lost.feed({...centre,x:.4},24);lost.events.length=0;assert.equal(lost.feed(null,30).tracking,false);
lost.feed({...centre,x:.7,y:.3},24);assert.equal(lost.events.length,0,'reacquisition fired phantom intent');
lost.feed({...centre,x:NaN});assert.equal(lost.events.length,0);
const face=(x,score)=>({boundingBox:{originX:x,originY:100,width:100,height:120},categories:[{score}]});
const previous=normaliseHead(face(180,1).boundingBox,640,480);
const selected=selectHead([face(430,.99),face(185,.8)],640,480,previous);assert(Math.abs(selected.x-previous.x)<.02,'tracker switched to bystander');
assert.equal(selectHead([face(180,.3)],640,480,null),null);
const box=previewBox({...previous,height:.25},160,120);assert.equal(box.h,30);
console.log(JSON.stringify({passed:true,steering:measurements,vertical,checks:['noise','single-frame spike','hold and rearm','loss recovery','confidence','face continuity','preview aspect','two lanes in one lean','gentle lean','lean is not a slide']},null,2));

// Crossing two lanes in one lean -- the thing the gesture model could not do,
// because every step needed its own excursion out to the side and back.
const cross=harness();cross.feed(centre,24);let player=2;
const drive=out=>{if(player!==out.lane)player+=Math.sign(out.lane-player);return out;};
for(let i=0;i<30;i++)drive(cross.feed({...centre,x:.4}));
assert.equal(player,0,'one lean from the right lane must reach the left lane');
for(let i=0;i<30;i++)drive(cross.feed(centre));
assert.equal(player,1,'centring the head must return to the middle lane');
for(let i=0;i<30;i++)drive(cross.feed({...centre,x:.6}));
assert.equal(player,2,'leaning the other way must reach the right lane');

// And the lean itself has to be one you can hold. A quarter of a head-width
// sat under the old 0.32 threshold and did nothing at all.
const gentle=harness();gentle.feed(centre,24);
gentle.feed({...centre,x:.5-.16*.25},24);
const gentleLanes=gentle.events.filter(e=>e.type==='lane');
assert.equal(gentleLanes.length,1,'a gentle lean must still steer');
assert.equal(gentleLanes[0].lane,0);
