export const LANE = 3.25;
export const MAX_SPEED = 36;
export const JUMP_V = 11.8;
export const GRAVITY = 23;
export const TRAIN_ROOF = 4.27;
export const TRAIN_CLEARANCE = 4.08;
export const TRAIN_HALF = 6.7;
export const RAMP_LENGTH = 14.5;
// How fast a grounded runner can be lifted by the ground under them. Riding a
// ramp at full speed only needs 8.8 m/s, so this never affects a normal climb --
// it exists so joining a ramp part-way up eases the player onto the slope
// instead of teleporting them several metres in a single step.
export const MAX_CLIMB = 20;
// Obstacles a reflex clears where a lane change is not needed: jump the
// hurdle, slide under the sign.
export const REFLEX_TYPES = ['hurdle','overhead'];
// The corridor between two gates that fillers may occupy. 16 m clears the
// gate's own train body (TRAIN_HALF 6.7); 24 m at the far end clears the next
// gate's access ramp, which reaches 21.2 m back from its anchor.
export const FILLER_START = 16, FILLER_END = 24;
// A jump lasts 1.03 s -- 37 m at top speed -- and anything airborne under an
// overhead sign is a hit. So when a run of hurdles gives way to a run of
// signs, the first sign gets a wide berth.
export const FILLER_SWITCH_PAD = 42;
// A jump is above hurdle height (0.93 m) from 0.086 s to 0.94 s after take-off
// -- a 0.85 s window, 30.7 m at top speed. A run of hurdles has to fit inside
// it, or clearing the first one lands the player on top of the third. 26 m
// leaves room to take off slightly early.
export const HURDLE_REACH = 26;
export const POWER_NAMES = {magnet:'Flux magnet',boost:'Double signal',shield:'Pulse shield',board:'Glide board'};
export function rng(seed=2039){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
// Difficulty follows metres travelled, not frame rate or spawn count.
export function difficultyAt(distance){const pressure=Math.min(1,Math.max(0,distance)/3200);return {pressure,speed:Math.min(MAX_SPEED,17+Math.max(0,distance)*.009),incomingSpeed:18+4*pressure,reaction:.55-.23*pressure};}
export function planPattern(index,previousSafe,random,distance=index*78){
  const difficulty=difficultyAt(distance),p=difficulty.pressure;
  const neighbours=[0,1,2].filter(l=>Math.abs(l-previousSafe)===1);
  const change=random()<.45+.5*p;
  const safe=change?neighbours[Math.floor(random()*neighbours.length)]:previousSafe;
  const lanes=[0,1,2].filter(l=>l!==safe);if(random()<.5)lanes.reverse();
  const pool=['hurdle','overhead','cargo','train','rampTrain','depart','gap'];
  const hazards=lanes.slice(0,index<2?1:2).map(lane=>({lane,type:random()<.15+.4*p?'approach':pool[Math.floor(random()*pool.length)]}));
  // Paired incoming trains share one clearly visible escape lane.
  if(index>=7&&random()<.15+.5*p)for(const h of hazards)h.type='approach';
  if(index===0)hazards[0].type='hurdle';
  if(index===1)hazards[0].type='overhead';
  if(index===3)hazards[0].type='rampTrain';
  if(index===5)hazards[0].type='approach';
  if(index===6)hazards[0].type='depart';
  if(index===8)hazards[0].type='gap';
  const spacing=54+MAX_SPEED*(.18+difficulty.reaction)+random()*(9-6*p);

  // One reflex per gap, held for four gates at a time. Mixing a jump and a
  // slide inside one gap is what makes a runner feel unfair: the jump arc is
  // longer than the corridor, so the player is still airborne when the sign
  // arrives with no way down. Sliding into a jump is free -- a jump cancels a
  // slide -- so only the switch into signs needs the wider pad.
  const reflex=REFLEX_TYPES[Math.floor(index/4)%2];
  const switched=index%4===0;
  const startPad=switched&&reflex==='overhead'?FILLER_SWITCH_PAD:FILLER_START;
  const span=spacing-startPad-FILLER_END;
  // Two lanes of the same obstacle take the sidestep away and force the
  // reflex, which is fair precisely because the whole gap asks for one thing.
  const doubled=p>.45&&random()<.22+.4*p;
  // Trains either side and something to clear in the escape lane: the route
  // the gate guarantees still exists, but taking it now costs a reflex at the
  // moment the trains are alongside. Skipped on a switch gap, where the
  // previous gap's last hurdle may still have the player in the air.
  const trains=hazards.every(h=>['train','approach','depart','rampTrain'].includes(h.type));
  const gate=(!switched&&trains&&index>=4&&random()<.1+.45*p)?{lane:safe,type:reflex,offset:0}:null;
  const fillers=[];
  const count=span<12?0:Math.min(3,1+Math.floor(p*2+random()*.7));
  // Hurdles have to fit one jump arc, measured from the gate obstacle when
  // there is one, since that is where the player takes off.
  const reach=reflex!=='hurdle'?span:Math.min(span,HURDLE_REACH-(gate?startPad:0));
  // Keeping at most two lanes blocked in any 2.5 m window is an invariant of
  // the whole set, not of one obstacle, so each lane is chosen from the ones
  // that keep every existing row legal -- biased onto the guaranteed route,
  // because an obstacle the player can stroll past in another lane is not an
  // obstacle at all.
  const crowded=set=>set.some(f=>new Set(set.filter(o=>Math.abs(o.offset-f.offset)<2.5).map(o=>o.lane)).size>2);
  const place=offset=>{
    const legal=[0,1,2].filter(l=>!crowded([...fillers,{lane:l,offset}]));
    if(!legal.length)return;
    const bias=[safe,safe,Math.max(0,safe-1),Math.min(2,safe+1)].filter(l=>legal.includes(l));
    const from=bias.length?bias:legal;
    fillers.push({lane:from[Math.floor(random()*from.length)],type:reflex,offset});
  };
  for(let i=0;i<count;i++){
    const offset=startPad+reach*(i+.15+random()*.7)/count;
    place(offset);
    // A second lane on the last row takes the sidestep away and forces the
    // reflex, which is fair precisely because the whole gap asks for one thing.
    if(doubled&&i===count-1)place(offset);
  }

  const pattern={index,safe,hazards,fillers,gate,spacing,level:Math.floor(p*10),reaction:difficulty.reaction,incomingSpeed:difficulty.incomingSpeed,pressure:p};
  if(!validatePattern(pattern,previousSafe))throw Error('Unsafe generated pattern: '+JSON.stringify(pattern));
  return pattern;
}
export function validatePattern(p,previousSafe){
  // Incoming leading edge at 22 m/s and recovery speed 14: 33.2 m
  // before its anchor. Departing tail clears by 16.9 m after its anchor.
  // 54 m conservatively covers both and the access ramp. Preserve a full
  // lane transition plus the distance-dependent reaction budget at top speed.
  if(!(p.hazards.every(h=>h.lane!==p.safe)&&Math.abs(p.safe-previousSafe)<=1&&
    (p.spacing-54)/MAX_SPEED+1e-9>=.18+(p.reaction??.55)))return false;
  const fillers=p.fillers||[];
  // One demand per gap, inside the corridor, and never all three lanes at
  // once -- that last one keeps a sidestep available even if the player
  // misses the input entirely.
  if(fillers.some(f=>!REFLEX_TYPES.includes(f.type)))return false;
  if(fillers.some(f=>f.type!==fillers[0].type))return false;
  if(fillers.some(f=>f.offset<FILLER_START-1e-9||f.offset>p.spacing-FILLER_END+1e-9))return false;
  // A run of hurdles must be clearable by one jump: see HURDLE_REACH.
  if(fillers.length&&fillers[0].type==='hurdle'){
    const lo=Math.min(...fillers.map(f=>f.offset)),hi=Math.max(...fillers.map(f=>f.offset));
    if(hi-lo>HURDLE_REACH+1e-9)return false;
    if(p.gate&&hi-Math.min(lo,p.gate.offset)>HURDLE_REACH+1e-9)return false;
  }
  for(const f of fillers)if(new Set(fillers.filter(o=>Math.abs(o.offset-f.offset)<2.5).map(o=>o.lane)).size>2)return false;
  if(p.gate&&(p.gate.lane!==p.safe||!REFLEX_TYPES.includes(p.gate.type)||
    (fillers.length&&p.gate.type!==fillers[0].type)))return false;
  return true;
}
export class PlayerController{
  constructor(){this.reset();}
  reset(){this.lane=1;this.x=0;this.y=0;this.vy=0;this.grounded=true;this.slide=0;this.invincible=0;this.stumble=0;this.land=0;this.surface=0;this.fall=0;this.lean=0;}
  move(dir){this.lane=Math.max(0,Math.min(2,this.lane+dir));}
  jump(){if(!this.grounded||this.fall)return false;this.vy=JUMP_V;this.grounded=false;this.slide=0;return true;}
  duck(){if(this.fall)return;this.slide=.8;if(!this.grounded)this.vy=Math.min(this.vy,-15);}
  step(dt,surface=0,smooth=false){
    const target=(this.lane-1)*LANE,old=this.x;
    this.x+=(target-this.x)*(1-Math.exp(-(smooth?20:23)*dt));
    this.lean+=(Math.max(-.36,Math.min(.36,(old-this.x)*3))-this.lean)*(1-Math.exp(-14*dt));
    this.slide=Math.max(0,this.slide-dt);this.invincible=Math.max(0,this.invincible-dt);this.stumble=Math.max(0,this.stumble-dt);this.land=Math.max(0,this.land-dt*4);
    this.surface=surface;
    if(this.grounded&&this.y>surface+.08)this.grounded=false;
    if(!this.grounded){this.vy-=GRAVITY*dt;this.y+=this.vy*dt;if(this.vy<=0&&this.y<=surface&&!this.fall){this.y=surface;this.vy=0;this.grounded=true;this.land=1;return 'land';}}
    else this.y=surface>this.y?Math.min(surface,this.y+MAX_CLIMB*dt):surface;
  }
}
export class SaveManager{
  constructor(storage){this.storage=storage;this.data={best:0,totalTokens:0,totalDistance:0,jumps:0,trains:0,powers:0};try{Object.assign(this.data,JSON.parse(storage.getItem('neon-rail-v1')||'{}'));}catch{} }
  save(){try{this.storage.setItem('neon-rail-v1',JSON.stringify(this.data));}catch{}}
}
export const MISSIONS=[{key:'totalTokens',target:100,text:'Collect 100 flux tokens'},{key:'totalDistance',target:1000,text:'Run 1,000 metres'},{key:'jumps',target:20,text:'Clear 20 obstacles'},{key:'trains',target:10,text:'Pass 10 trains'},{key:'powers',target:3,text:'Activate 3 power-ups'}];
