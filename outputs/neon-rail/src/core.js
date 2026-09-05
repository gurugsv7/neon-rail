export const LANE = 3.25;
export const MAX_SPEED = 30;
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
export const POWER_NAMES = {magnet:'Flux magnet',boost:'Double signal',shield:'Pulse shield',board:'Glide board'};
export function rng(seed=2039){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
export function planPattern(index, previousSafe, random){
  const level=Math.min(4,Math.floor(index/7));
  const choices=[0,1,2].filter(l=>Math.abs(l-previousSafe)<=1);
  const safe=choices[Math.floor(random()*choices.length)];
  const lanes=[0,1,2].filter(l=>l!==safe);
  const types=['hurdle','overhead','cargo','train','rampTrain','approach','depart','gap'];
  const count=index<2?1:2;
  const hazards=lanes.slice(0,count).map((lane,i)=>({lane,type:index===0?'hurdle':index===1?'overhead':types[Math.floor(random()*Math.min(types.length,4+level))]}));
  // First roof sequence is an intentional introduction, with an open bypass lane.
  if(index===3)hazards[0].type='rampTrain';
  if(index===5)hazards[0].type='approach';
  if(index===6)hazards[0].type='depart';
  if(index===8)hazards[0].type='gap';
  const spacing=82-level*2+random()*9;
  const p={index,safe,hazards,spacing,level};
  if(!validatePattern(p,previousSafe))throw Error('Unsafe generated pattern');
  return p;
}
export function validatePattern(p, previousSafe){
  // Trains stay in their lanes and move continuously through the encounter.
  // At the slowest recovery speed (14 m/s), the incoming leading edge can
  // reach 31.1 m before its anchor; a departing tail clears 16.9 m after it.
  // A conservative 50 m envelope also includes the 14.5 m access ramp.
  // Even at 30 m/s, the gap permits a lane change plus 550 ms reaction time.
  const envelope=50;
  const switchSeconds=Math.abs(p.safe-previousSafe)*0.18;
  return p.hazards.every(h=>h.lane!==p.safe)&&Math.abs(p.safe-previousSafe)<=1&&
    (p.spacing-envelope)/MAX_SPEED>=switchSeconds+0.55;
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
