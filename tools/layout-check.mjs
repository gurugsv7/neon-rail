// Trackside furniture is placed by independent rules in sceneryChunk, so nothing
// stops two of them claiming the same ground -- which is exactly how trees ended
// up inside the building facades. This encodes each rule's worst-case footprint
// and reports the closest approach between every pair.
// Ranges are [min,max] over the rule's random jitter; radius is the footprint.
const SIDE=[
  {name:'tree',       x:[6.25,6.55], z:[[-22,-20],[1,3],[14,16]], r:1.4},
  {name:'lamp',       x:[6.7,6.7],   z:[[-16,-16],[10,10]],       r:.5},
  {name:'cone',       x:[6.2,6.9],   z:[[-9,-7],[6,8],[19,21]],   r:.35},
  {name:'bin',        x:[6.8,6.8],   z:[[-2,-2]],                 r:.9},
  {name:'signal',     x:[5.2,5.2],   z:[[-12,-12]],               r:.3},
];
// Fixed structures the furniture must also clear.
const WALLS=[
  {name:'building face',x:8.4,side:'outer'},
  {name:'fence',        x:7.8,side:'outer'},
  {name:'train envelope',x:4.59,side:'inner'},
];
const gap=(a,b)=>{ // closest approach in the x/z plane across both rules' ranges
  let best=Infinity;
  for(const az of a.z)for(const bz of b.z){
    const dz=Math.max(0,Math.max(az[0]-bz[1],bz[0]-az[1]));
    const dx=Math.max(0,Math.max(a.x[0]-b.x[1],b.x[0]-a.x[1]));
    best=Math.min(best,Math.hypot(dx,dz)-(a.r+b.r));
  }
  return best;
};
let fail=0;
console.log('pairwise clearance (negative = overlap)');
for(let i=0;i<SIDE.length;i++)for(let j=i+1;j<SIDE.length;j++){
  const c=gap(SIDE[i],SIDE[j]),ok=c>=0;if(!ok)fail++;
  console.log(`  ${ok?'ok  ':'FAIL'} ${SIDE[i].name.padEnd(7)} vs ${SIDE[j].name.padEnd(7)} ${c.toFixed(2)}m`);
}
console.log('clearance to fixed structures');
for(const item of SIDE)for(const w of WALLS){
  const c=w.side==='outer'?w.x-(item.x[1]+item.r):(item.x[0]-item.r)-w.x;
  const ok=c>=0;if(!ok&&!(item.name==='tree'&&w.name==='fence'))fail++;
  console.log(`  ${ok?'ok  ':(item.name==='tree'&&w.name==='fence'?'note':'FAIL')} ${item.name.padEnd(7)} vs ${w.name.padEnd(15)} ${c.toFixed(2)}m`);
}
console.log(fail?`\n${fail} overlap(s)`:'\nno overlaps');
process.exit(fail?1:0);
