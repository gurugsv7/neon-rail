import assert from 'node:assert/strict';
import {planPattern,validatePattern,rng,PlayerController,SaveManager} from '../src/core.js';
let checked=0,minimumClearance=Infinity;
for(let seed=1;seed<=100;seed++){
  const random=rng(seed);let safe=1;
  for(let index=0;index<1000;index++){
    const pattern=planPattern(index,safe,random);
    assert(validatePattern(pattern,safe));
    assert(pattern.hazards.every(h=>h.lane!==pattern.safe));
    minimumClearance=Math.min(minimumClearance,(pattern.spacing-50)/30);
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
assert(minimumClearance>.18+.55);
console.log(JSON.stringify({passed:true,patterns:checked,minimumClearanceSeconds:minimumClearance,jumpApex:peak,laneSwitch:true,airborneSwitch:true,landing:true,slideExpiry:true,saveReload:true},null,2));
