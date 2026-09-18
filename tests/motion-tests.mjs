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
  const count=h.events.length;h.feed({...centre,x:.5-.16*.55},hz*3);assert.equal(h.events.length,count,'held lean repeated');
  h.feed(centre,hz);assert.equal(h.events.length,count,'neutral must not move player');
  h.feed({...centre,x:.5-.16*.55},hz);assert.equal(h.events.length,count+1);assert.equal(h.events.at(-1).direction,-1);
}
for(const kind of ['jump','duck']){
  const h=harness();h.feed(centre,24);const pose={...centre,y:.5+(kind==='jump'?-.09:.09)};
  h.feed(pose,96);assert.equal(h.events.filter(e=>e.type===kind).length,1,'held pose must fire once');
  h.feed(centre,24);h.feed(pose,24);assert.equal(h.events.filter(e=>e.type===kind).length,2,'neutral must rearm');
}
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
console.log(JSON.stringify({passed:true,steering:measurements,checks:['noise','single-frame spike','hold and rearm','loss recovery','confidence','face continuity','preview aspect']},null,2));

const stepper=harness();stepper.feed(centre,24);let playerLane=2;
stepper.feed({...centre,x:.4},72);for(const e of stepper.events)if(e.type==='lane')playerLane+=e.direction;
assert.equal(playerLane,1,'one lean from right must stop in middle');stepper.events.length=0;
stepper.feed({...centre,x:.6},48);assert.equal(stepper.events.length,0,'opposite lean without neutral must not retrigger');
stepper.feed(centre,24);stepper.feed({...centre,x:.4},48);assert.equal(stepper.events.filter(e=>e.type==='lane').length,1);
