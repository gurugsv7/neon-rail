import assert from 'node:assert/strict';
import {createBodySignal,bodyFrame} from '../src/body-signal.js';
function pose(){const p=Array.from({length:33},()=>({x:.5,y:.4,visibility:.99}));for(const [i,x,y] of [[0,.5,.13],[11,.42,.28],[12,.58,.28],[23,.45,.53],[24,.55,.53],[25,.45,.71],[26,.55,.71],[27,.45,.9],[28,.55,.9],[15,.35,.5],[16,.65,.5]])Object.assign(p[i],{x,y});return p;}
const original=pose();assert.equal(bodyFrame(original).guide,'fit');
const shifted=(dx,scale=1)=>original.map(p=>({...p,x:p.x+dx,y:.5+(p.y-.5)*scale}));
assert.equal(bodyFrame(shifted(.3)).guide,'right');assert.equal(bodyFrame(shifted(-.3)).guide,'left');assert.equal(bodyFrame(shifted(0,.5)).guide,'forward');assert.equal(bodyFrame(shifted(0,1.2)).guide,'back');
const occluded=pose();occluded[27].visibility=.1;assert.equal(bodyFrame(occluded).guide,'back');
let time=1000;const signal=createBodySignal();function feed(p,n=1){let out;for(let i=0;i<n;i++){out=signal.update(p,time);time+=1000/18;}return out;}
feed(original,25);assert.equal(feed(original,80).running,false,'standing is not running');
for(let i=0;i<50;i++){const bob=pose();bob[0].y+=Math.sin(i)*.06;assert(!feed(bob).running,'head bob cannot count');}
function lift(side){const p=pose();p[side===1?25:26].y-=.065;p[side===1?27:28].y-=.07;return p;}
assert(!feed(lift(1),40).running,'holding a knee cannot count');feed(original,30);
feed(lift(-1),7);feed(lift(1),7);let out=feed(lift(-1),7);assert(out.running,'alternating steps should enable running');
const hands=lift(1);hands[15].y=hands[16].y=.16;let jumps=0;for(let i=0;i<7;i++)jumps+=feed(hands).intents.filter(i=>i.type==='jump').length;assert.equal(jumps,1);
assert(!feed(original,30).running,'stopping must hold the game');
assert(!feed(null).running,'lost person must stop immediately');feed(null,25);assert.equal(feed(original).guide,'still','lost tracking recalibrates');
console.log('PASS body framing, calibration, head-only rejection, held-knee rejection, alternating gait, hands-up, stop and loss recovery');

signal.reset();feed(original,25);feed(lift(1),7);feed(lift(-1),7);feed(lift(1),7);
const squat=pose();for(const i of [11,12,23,24])squat[i].y+=.10;
let ducks=0;for(let i=0;i<8;i++)ducks+=feed(squat).intents.filter(e=>e.type==='duck').length;assert.equal(ducks,1,'squat must trigger one slide');
const left=pose().map(p=>({...p,x:p.x+.09}));let lanes=[];for(let i=0;i<30;i++)lanes.push(...feed(left).intents.filter(e=>e.type==='lane'));assert.equal(lanes.length,1);assert.equal(lanes[0].direction,-1);
