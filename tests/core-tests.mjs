import assert from 'node:assert/strict';
import {planPattern,validatePattern,rng,PlayerController,SaveManager,MAX_SPEED,difficultyAt,REFLEX_TYPES,FILLER_START,FILLER_END} from '../src/core.js';
let checked=0,minimumClearance=Infinity;
for(let seed=1;seed<=100;seed++){
  const random=rng(seed);let safe=1;
  for(let index=0;index<1000;index++){
    const pattern=planPattern(index,safe,random);
    assert(validatePattern(pattern,safe));
    assert(pattern.hazards.every(h=>h.lane!==pattern.safe));
    // Corridor fillers: one demand per gap, inside the corridor, and never
    // all three lanes at one point -- a player who misses the input entirely
    // must still have somewhere to step.
    for(const f of pattern.fillers){
      assert(REFLEX_TYPES.includes(f.type));
      assert(f.type===pattern.fillers[0].type);
      assert(f.offset>=FILLER_START-1e-9&&f.offset<=pattern.spacing-FILLER_END+1e-9);
      assert(new Set(pattern.fillers.filter(o=>Math.abs(o.offset-f.offset)<2.5).map(o=>o.lane)).size<=2);
    }
    if(pattern.gate){
      assert(pattern.gate.lane===pattern.safe);
      assert(REFLEX_TYPES.includes(pattern.gate.type));
      assert(pattern.hazards.every(h=>['train','approach','depart','rampTrain'].includes(h.type)));
      if(pattern.fillers.length)assert(pattern.gate.type===pattern.fillers[0].type);
    }
    minimumClearance=Math.min(minimumClearance,(pattern.spacing-54)/MAX_SPEED);
    safe=pattern.safe;checked++;
  }
}
const p=new PlayerController();p.move(-1);
for(let i=0;i<24;i++)p.step(1/120);
assert(Math.abs(p.x+3.25)<.04);
assert(p.jump());assert(!p.jump());let peak=0;
for(let i=0;i<180;i++){if(i===30)p.move(1);p.step(1/120);peak=Math.max(peak,p.y);}
assert(peak>2.9&&peak<3.1);assert(p.grounded&&p.y===0);assert(Math.abs(p.x)<.001);
p.duck();for(let i=0;i<120;i++)p.step(1/120);assert(p.slide===0);
const store=new Map();const storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
const save=new SaveManager(storage);save.data.best=1234;save.save();assert(new SaveManager(storage).data.best===1234);
assert(minimumClearance>=.18+.32);
assert(difficultyAt(0).speed<difficultyAt(1000).speed);
assert(difficultyAt(5000).speed===MAX_SPEED);
console.log(JSON.stringify({passed:true,patterns:checked,minimumClearanceSeconds:minimumClearance,jumpApex:peak,laneSwitch:true,airborneSwitch:true,landing:true,slideExpiry:true,saveReload:true},null,2));

function sample(distance){
  let pairs=0,changes=0,spacing=0,safe=1,fillers=0,gates=0,track=0;const marks=[];
  const random=rng(781);
  for(let i=10;i<1010;i++){const p=planPattern(i,safe,random,distance);
    pairs+=p.hazards.every(h=>h.type==='approach');changes+=p.safe!==safe;spacing+=p.spacing;
    fillers+=p.fillers.length;gates+=p.gate?1:0;
    marks.push(track);for(const f of p.fillers)marks.push(track+f.offset);
    track+=p.spacing;safe=p.safe;}
  marks.sort((a,b)=>a-b);
  const speed=difficultyAt(distance).speed;
  const runs=[];for(let i=1;i<marks.length;i++)runs.push(marks[i]-marks[i-1]);
  runs.sort((a,b)=>a-b);
  return {pairs,changes,spacing:+(spacing/1000).toFixed(1),fillersPerGate:+(fillers/1000).toFixed(2),
    trainGatesWithObstacle:gates,
    medianGapSeconds:+(runs[runs.length>>1]/speed).toFixed(2),
    worstGapSeconds:+(runs[runs.length-1]/speed).toFixed(2)};
}
const early=sample(100),late=sample(4500);
assert(late.pairs>early.pairs*2);assert(late.changes>early.changes);assert(late.spacing<early.spacing);
// The point of the corridor fillers: the long empty stretches are gone and
// the late game asks for something roughly twice as often as the early game.
assert(late.fillersPerGate>early.fillersPerGate*2);
assert(late.trainGatesWithObstacle>early.trainGatesWithObstacle*3);
assert(early.medianGapSeconds<2.6);
assert(late.medianGapSeconds<early.medianGapSeconds);
console.log({early,late});
