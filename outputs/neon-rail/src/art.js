import {securityDrone} from './security-drone.js';
import {ICON_PATHS} from './icons.js';
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {LANE,rng,TRAIN_ROOF,RAMP_LENGTH} from './core.js';
import {importedTrain,importedRampTrain} from './train-asset.js';
import {cityBuilding,buildingNames,buildingSize,BUILDING_SCALE,BUILDING_TINTS,CONTAINER_TINT} from './city-buildings-asset.js';
import {treeModel,treeNames} from './tree-asset.js';
import {railTile,RAIL_GAUGE,RAIL_TILE_LENGTH} from './rail-asset.js';
import {cityModel} from './city-asset.js';
import {addRailArchitecture} from './rail-architecture.js';
export {T};
const geometries=new Map(),materials=new Map();
export function mat(color,extra={}){const key=color+JSON.stringify(extra);if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color,roughness:.76,...extra}));return materials.get(key);}
// Drawn from at random per building so the street never repeats; the backdrop
// row leans on the taller pieces to keep the canyon the old blocks gave.
let FRONTAGE=[],BACKDROP=[],TREES=[];
export function indexBuildings(){
  TREES=treeNames();
  // Industrial blocks sit on the frontage alongside the commercial ones: a rail
  // corridor runs past warehouses as readily as shops.
  FRONTAGE=[...buildingNames('com-building-').filter(n=>!n.includes('skyscraper')),...buildingNames('ind-building-')];
  BACKDROP=[...buildingNames('com-building-skyscraper'),...buildingNames('com-low-detail-'),
    ...buildingNames('ind-water-tower'),...buildingNames('ind-chimney-'),...buildingNames('ind-detail-tank-large')];
}
const palette={teal:0x197779,cream:0xf4e5c6,dark:0x24434d,coral:0xee7959,mint:0xbbed7c,steel:0x80939a};
// Palette for the imported track tiles, keyed by the part names in the asset.
const TRACK={railTop:[0xaebbb4,{metalness:.55,roughness:.42}],railDamage:[0x8d9a93,{metalness:.45,roughness:.5}],railBody:[0x55696a,{}],sleeperTop:[0x8a705a,{}],sleeperSide:[0x6d5747,{}]};
export function box(g,w,h,d,x=0,y=0,z=0,color=0xffffff,rounded=false){const key=rounded?'round':'box';if(!geometries.has(key))geometries.set(key,rounded?new RoundedBoxGeometry(1,1,1,2,.13):new T.BoxGeometry(1,1,1));const m=new T.Mesh(geometries.get(key),typeof color==='object'?color:mat(color));m.scale.set(w,h,d);m.position.set(x,y,z);g.add(m);return m;}
export function cyl(g,rt,rb,h,x,y,z,color,segments=10){const key=`c${rt},${rb},${h},${segments}`;if(!geometries.has(key))geometries.set(key,new T.CylinderGeometry(rt,rb,h,segments));const m=new T.Mesh(geometries.get(key),typeof color==='object'?color:mat(color));m.position.set(x,y,z);g.add(m);return m;}
export function sphere(g,r,x,y,z,color,sx=1,sy=1,sz=1){if(!geometries.has('sphere'))geometries.set('sphere',new T.SphereGeometry(1,12,8));const m=new T.Mesh(geometries.get('sphere'),typeof color==='object'?color:mat(color));m.scale.set(r*sx,r*sy,r*sz);m.position.set(x,y,z);g.add(m);return m;}
export function signTexture(text,bg='#f5dfac',fg='#24575c',size=512){const c=document.createElement('canvas');c.width=size;c.height=128;const x=c.getContext('2d');x.fillStyle=bg;x.fillRect(0,0,size,128);x.fillStyle=fg;x.font=`900 ${text.length>17?28:42}px Arial`;x.textAlign='center';x.textBaseline='middle';x.fillText(text,size/2,66);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return new T.MeshStandardMaterial({map:t,roughness:.8});}
const signs={station:signTexture('MERIDIAN  /  EAST LINE'),warning:signTexture('↓   KEEP LOW   ↓','#f5c552','#263e47'),rail:signTexture('M / MERIDIAN','#f0e7cc','#27686a'),post:signTexture('THE CITY IS YOURS','#df7059','#f5e8cd'),art:signTexture('keep moving. ↗','#247d7b','#c2eb9d'),cargo:signTexture('MTR  /  08','#dfa959','#3c575c')};
export function staticBatch(group){group.updateMatrixWorld(true);const buckets=new Map();group.traverse(o=>{if(o.isMesh&&!Array.isArray(o.material)){const id=o.material.uuid;if(!buckets.has(id))buckets.set(id,{material:o.material,geos:[]});const geo=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrixWorld);buckets.get(id).geos.push(geo);}});group.clear();for(const {material,geos} of buckets.values()){const merged=mergeGeometries(geos,false);if(merged){const m=new T.Mesh(merged,material);m.receiveShadow=true;group.add(m);}for(const geo of geos)geo.dispose();}return group;}
export function courier(){const root=new T.Group(),rig=new T.Group();root.add(rig);const hips=new T.Group();hips.position.y=.91;rig.add(hips);
  box(hips,.62,.45,.39,0,.05,0,palette.dark,true);
  const torso=new T.Group();torso.position.y=.26;hips.add(torso);
  box(torso,.76,.68,.46,0,.29,0,palette.coral,true);
  box(torso,.79,.13,.49,0,.02,0,0xf7d680,true);
  // Courier backpack, luminous parcel latch, diagonal shoulder straps.
  box(torso,.55,.6,.23,0,.32,.31,palette.teal,true);box(torso,.43,.22,.1,0,.22,.45,palette.cream,true);box(torso,.14,.07,.03,0,.46,.446,mat(palette.mint,{emissive:palette.mint,emissiveIntensity:.3}),true);
  box(torso,.08,.65,.03,-.25,.3,-.246,palette.cream);box(torso,.08,.65,.03,.25,.3,-.246,palette.cream);
  const head=new T.Group();head.position.y=.81;torso.add(head);
  cyl(head,.12,.13,.16,0,-.07,0,0xb87550);sphere(head,.28,0,.22,0,0xc98c64,.89,1.08,.9);
  sphere(head,.285,0,.33,.03,0x263741,1,.73,1);box(head,.51,.12,.48,0,.39,0,palette.teal,true);box(head,.43,.045,.28,0,.34,-.23,palette.teal,true);
  box(head,.37,.105,.04,0,.22,-.245,0xffda82,true);box(head,.07,.07,.035,0,.22,-.27,0x35525a);
  for(const side of [-1,1]){sphere(head,.085,side*.255,.16,0,palette.coral);}
  const arms=[],legs=[];
  for(const side of [-1,1]){const arm=new T.Group();arm.position.set(side*.47,.51,0);torso.add(arm);cyl(arm,.145,.125,.39,0,-.16,0,palette.coral);const fore=new T.Group();fore.position.set(0,-.34,0);arm.add(fore);cyl(fore,.11,.085,.35,0,-.13,-.08,0xc98c64);sphere(fore,.11,0,-.3,-.15,palette.dark);arms.push(arm);
    const leg=new T.Group();leg.position.set(side*.205,-.13,0);hips.add(leg);cyl(leg,.16,.125,.47,0,-.2,0,palette.dark);const shin=new T.Group();shin.position.y=-.42;leg.add(shin);cyl(shin,.12,.095,.4,0,-.17,0,0x2f5560);box(shin,.24,.15,.44,0,-.39,-.095,palette.cream,true);box(shin,.25,.06,.46,0,-.47,-.10,palette.coral,true);box(shin,.12,.045,.18,0,-.30,-.19,palette.teal);legs.push({leg,shin});}
  root.traverse(o=>{if(o.isMesh)o.castShadow=true;});
  return {root,rig,hips,torso,head,arms,legs};
}
export function animateCourier(c,p,t,speed,board=false){const run=t*speed*.72,air=!p.grounded,slide=p.slide>0;const swing=air?.15:Math.sin(run)*.72;
  c.rig.rotation.z=p.lean+(p.stumble>0?Math.sin(t*34)*.13:0);
  c.hips.position.y=slide?.43:.99-(p.land*.12)+(air?0:Math.abs(Math.sin(run))*.055);
  c.torso.rotation.x=slide?-1.15:air?-.16:.1;
  c.hips.rotation.y=board?.28:Math.sin(run)*.04;
  c.arms.forEach((a,i)=>{a.rotation.x=slide?-1.4:air?-1.3:(i===0?-swing:swing);a.rotation.z=(i===0?1:-1)*.1;});
  c.legs.forEach(({leg,shin},i)=>{leg.rotation.x=slide?(i===0?-1.3:-.6):air?(i===0?-.7:.5):(i===0?swing:-swing);shin.rotation.x=slide?1.3:air?.8:Math.max(0,(i===0?-swing:swing))*.9;});
}
export function drone(){return securityDrone();}
export function tokenModel(){const g=new T.Group();const body=cyl(g,.22,.22,.085,0,0,0,mat(0xc5f58a,{metalness:.45,roughness:.25,emissive:0x8dcf43,emissiveIntensity:.35}),6);body.rotation.x=Math.PI/2;const inset=cyl(g,.115,.115,.09,0,0,0,0x26766a,6);inset.rotation.x=Math.PI/2;box(g,.035,.14,.10,0,0,0,0xecffd1);return g;}
export const POWER_COLORS={magnet:0x64dddd,boost:0xffcf69,shield:0x7caaff,board:0xe9a1ef};
const badgeMaterials=new Map();
function badgeMaterial(type,color){
  if(badgeMaterials.has(type))return badgeMaterials.get(type);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#173d49';ctx.beginPath();ctx.arc(64,64,60,0,Math.PI*2);ctx.fill();
  ctx.save();ctx.translate(22,22);ctx.scale(3.5,3.5);ctx.strokeStyle='#'+color.toString(16);ctx.lineWidth=1.9;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke(new Path2D(ICON_PATHS[type]));ctx.restore();
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
  const material=new T.MeshBasicMaterial({map,transparent:true,side:T.DoubleSide});badgeMaterials.set(type,material);return material;
}
export function powerModel(type){
  const g=new T.Group(),color=POWER_COLORS[type],m=mat(color,{emissive:color,emissiveIntensity:.45,metalness:.25,roughness:.3});
  const ring=new T.Mesh(new T.TorusGeometry(.55,.045,8,32),m);g.add(ring);
  const badge=new T.Mesh(new T.PlaneGeometry(1.04,1.04),badgeMaterial(type,color));g.add(badge);
  return g;
}
export function trainModel(ramped){const supplied=ramped?importedRampTrain():importedTrain();if(supplied)return supplied;const g=new T.Group();box(g,2.65,3.8,13,0,2.25,0,palette.teal,true);box(g,2.7,.52,12.5,0,1.35,0,palette.cream,true);box(g,2.5,.17,12.6,0,4.18,0,palette.cream,true);box(g,2.32,.34,12.5,0,.29,0,palette.dark,true);
  for(const z of [-6.55,6.55]){box(g,2.38,3.25,.25,0,2.3,z,palette.teal,true);box(g,2.1,1.12,.045,0,3.08,z+Math.sign(z)*.14,0x254857,true);box(g,.15,1.2,.06,0,3.06,z+Math.sign(z)*.17,palette.teal);box(g,1.7,.23,.045,0,3.91,z+Math.sign(z)*.15,signTexture('E7 / EAST', '#243f48','#e2efb2',256));for(const x of [-.85,.85])box(g,.32,.2,.07,x,1.15,z+Math.sign(z)*.17,mat(0xffedb8,{emissive:0xffd285,emissiveIntensity:1.8}),true);box(g,2,.12,.18,0,.65,z+Math.sign(z)*.13,palette.coral,true);}
  for(const side of [-1,1]){for(let z=-4.8;z<=4.8;z+=1.6){box(g,.035,1.12,1.17,side*1.334,3.08,z,0x294d5b,true);box(g,.04,.04,1.06,side*1.36,2.66,z,0x7fb5bb);}for(const z of [-4.2,4.2]){box(g,.05,2.65,.68,side*1.34,1.85,z,palette.cream);box(g,.055,1.1,.43,side*1.38,2.85,z,0x2e5560);}for(const z of [-4.5,-3.4,3.4,4.5]){const w=cyl(g,.32,.32,.18,side*1.1,.25,z,0x293a3e,12);w.rotation.z=Math.PI/2;}}
  for(const z of [-3,2]){box(g,1.3,.13,1.4,0,4.32,z,0x8caaa7,true);for(let j=-.45;j<.6;j+=.18)box(g,.8,.025,.06,0,4.39,z+j,palette.dark);}
  return staticBatch(g);
}
export function obstacleModel(type){if(['train','approach','depart','rampTrain'].includes(type))return trainModel(type==='rampTrain');const g=new T.Group();if(type==='hurdle'){const barrier=cityModel('construction-barrier');
    if(barrier){
      // The barrier is an extrusion, so stretching it along its length to span
      // the lane costs no fidelity -- only the cross-section is scaled evenly.
      barrier.scale.set(4.6,6.9,11.6);barrier.rotation.y=Math.PI/2;g.add(barrier);
      // Concrete alone is quieter than the striped bar this replaces, so it
      // keeps the game's hazard cap: the player has to read 'jump' instantly.
      box(g,2.64,.11,.66,0,.93,0,0xf1b94c,true);box(g,2.64,.05,.69,0,1.0,0,0xffeb9a);
    }else{for(const x of [-1.04,1.04]){box(g,.13,.85,.26,x,.42,0,palette.dark);box(g,.48,.1,.6,x,.05,0,palette.steel);}box(g,2.6,.58,.36,0,.72,0,0xf1b94c,true);for(let x=-1.1;x<=1.1;x+=.45){const m=box(g,.2,.48,.015,x,.73,.19,palette.dark);m.rotation.z=-.4;}box(g,2.6,.07,.39,0,1.025,0,0xffeb9a);}}
  if(type==='overhead'){for(const x of [-1.35,1.35])box(g,.16,2.8,.3,x,1.4,0,palette.coral);box(g,2.9,1.4,.55,0,2.3,0,0xf0c652,true);box(g,2.5,.55,.018,0,2.03,.287,signs.warning);for(const x of [-1.15,1.15])sphere(g,.10,x,2.9,0,mat(0xff6c38,{emissive:0xff5829,emissiveIntensity:.7}));}
  if(type==='cargo'){const crate=cityBuilding('ind-shipping-container-a',CONTAINER_TINT);
    if(crate){
      // Turned across the line, and sized off the numbers the game actually
      // reads: the roof lands exactly on the 1.42 landing plane and the depth
      // stays inside the .75 collision half-width so nothing clips unfairly.
      crate.scale.set(1.087,1.102,.853);crate.rotation.y=Math.PI/2;g.add(crate);
      box(g,1.5,.45,.02,0,.82,.74,signs.cargo);
    }else{box(g,2.3,1.36,1.6,0,.72,0,0xd49b59,true);for(const x of [-.85,.85])box(g,.1,1.45,1.67,x,.72,0,palette.dark);box(g,1.5,.45,.02,0,.8,.81,signs.cargo);box(g,2.5,.14,1.8,0,.08,0,palette.dark);}}
  if(type==='gap'){box(g,3.0,.045,5.7,0,.024,0,0x18313b);box(g,2.6,.05,4.8,0,.05,0,0x0e202a);for(const z of [-2.8,2.8]){box(g,3,.08,.16,0,.08,z,0xf3b84e);for(const x of [-1.4,1.4])sphere(g,.095,x,.2,z,mat(0xff7952,{emissive:0xff5222,emissiveIntensity:1}));}}
  return staticBatch(g);
}
export function rampModel(){const g=new T.Group();const geo=new T.BufferGeometry(),half=RAMP_LENGTH/2;const verts=[-1.3,0,half,1.3,0,half,-1.3,TRAIN_ROOF,-half,1.3,0,half,1.3,TRAIN_ROOF,-half,-1.3,TRAIN_ROOF,-half];geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.computeVertexNormals();const mesh=new T.Mesh(geo,mat(0xdeaf62,{side:T.DoubleSide}));g.add(mesh);for(const x of [-1.2,1.2]){const edge=box(g,.1,.07,Math.hypot(RAMP_LENGTH,TRAIN_ROOF),x,TRAIN_ROOF/2,0,0xffda8b);edge.rotation.x=Math.atan2(TRAIN_ROOF,RAMP_LENGTH);}return g;}
export function sceneryChunk(index,length=48){const g=new T.Group(),houses=[],random=rng(index*3141+81),zone=Math.floor(index/3)%4;
  box(g,10.6,.3,length,0,-.25,0,zone===2?0x88908a:0x9a9e8e);for(const x of [-6.4,6.4]){box(g,2.3,.46,length,x,-.13,0,0xd3c6a9);box(g,.17,.18,length,x-Math.sign(x)*1.15,.13,0,0xf4d879);}
  // Track is Kenney's tile kit, straight and damaged mixed on the chunk seed.
  // The tiles ship no texture -- their source atlas is flat swatches -- so each
  // part is coloured from TRACK below and merges into the same static batch as
  // the rest of the chunk, costing no extra draw call.
  const tiles=6,tileLength=length/tiles,gauge=.67/RAIL_GAUGE;
  for(let lane=-1;lane<=1;lane++)for(let t=0;t<tiles;t++){
    const parts=railTile(random()<.3),z=-length/2+tileLength*(t+.5),flipped=random()<.5;
    if(!parts){for(const side of [-.67,.67]){box(g,.095,.1,tileLength,lane*LANE+side,.02,z,mat(0x99a6a0,{metalness:.62,roughness:.43}));box(g,.18,.035,tileLength,lane*LANE+side,-.02,z,0x4b6261);}continue;}
    for(const {part,geometry} of parts){
      const m=new T.Mesh(geometry,mat(...TRACK[part]));
      m.position.set(lane*LANE,-.105,z);m.scale.set(gauge,gauge,tileLength/RAIL_TILE_LENGTH);
      // Tiles are turned end for end half the time so the same broken sleeper
      // does not repeat down the whole line. Decided once per tile: flipping
      // parts independently would pull the tile apart.
      if(flipped)m.rotation.y=Math.PI;
      m.receiveShadow=true;g.add(m);
    }
  }
  for(const side of [-1,1]){
    box(g,.25,.85,length,side*7.8,.2,0,0x7a9290);
    for(let z=-22;z<24;z+=4){box(g,.07,1.1,.07,side*7.8,1.05,z,0x576f70);}for(const y of [.7,1.4])box(g,.04,.04,length,side*7.8,y,0,0x516c6f);
    // The street is Kenney's commercial kit: a detailed shopfront on the
    // frontage and a plainer block behind, both drawn from the whole set and
    // tinted per instance so no two stretches of street repeat.
    for(let j=0;j<3;j++){
      const z=-16+j*17+random()*3;
      const front=FRONTAGE[Math.floor(random()*FRONTAGE.length)],size=buildingSize(front);
      const house=size&&cityBuilding(front,Math.floor(random()*BUILDING_TINTS));
      if(house){house.scale.setScalar(BUILDING_SCALE);house.position.set(side*(8.4+size[0]/2),-.2,z);
        house.rotation.y=-side*Math.PI/2;houses.push(house);}
      else box(g,7,13,7,side*11.9,6.3,z,0xd8997e);
      const backName=BACKDROP[Math.floor(random()*BACKDROP.length)],backSize=buildingSize(backName);
      const back=backSize&&cityBuilding(backName,Math.floor(random()*BUILDING_TINTS));
      if(back){back.scale.setScalar(BUILDING_SCALE);
        back.position.set(side*(9+backSize[0]/2+random()*3),-.2,z+8.5);
        back.rotation.y=-side*Math.PI/2;houses.push(back);}
      if(j===1)box(g,.03,2.4,6.4,side*8.3,14,z+8.5,signs.post);}
    // Deliberate clusters of transit furniture.
    // Kenney's gooseneck lamppost replaces a cylinder plus two flat boxes. The
    // arm is authored along +Z, so side*PI/2 swings it inward over the track.
    for(const z of [-16,10]){const lamp=cityModel('light-curved');
      if(lamp){lamp.scale.setScalar(8.9);lamp.position.set(side*6.7,-.1,z);lamp.rotation.y=side*Math.PI/2;g.add(lamp);}
      else{cyl(g,.08,.11,5.8,side*6.7,2.85,z,0x446771);box(g,1.4,.08,.12,side*6.2,5.7,z,0x446771);box(g,.65,.08,.35,side*5.6,5.62,z,mat(0xffedc8,{emissive:0xffdaa2,emissiveIntensity:.3}));}}
    if(index%2===1)for(const z of [-9,6,19]){const cone=cityModel('construction-cone');
      if(cone){cone.scale.setScalar(8);cone.position.set(side*(6.2+random()*.7),.1,z+random()*2);cone.rotation.y=random()*6.28;g.add(cone);}}
    const bin=cityModel('dumpster');
    if(bin){bin.scale.setScalar(4.78);bin.position.set(side*6.8,-.1,-2);g.add(bin);}
    else{box(g,.75,1.2,.75,side*6.8,.65,-2,0x4b817c,true);box(g,.035,.13,.5,side*6.39,.96,-2,0xc9dcb9);}
    // Trees stand on the pavement, not in the building line: the old x of
    // 8.7-9.7 put them inside facades that now start at 8.4. Their z slots are
    // chosen to miss the lamps (-16, 10), signal (-12), cones (-9, 6, 19) and
    // bin (-2), and the station zone is skipped so nothing grows through the
    // platform canopy.
    if(index%2===0&&zone!==1&&zone!==3)for(const [k,slot] of [-21,2,15].entries()){
      const tree=treeModel(TREES[Math.floor(random()*TREES.length)]);
      const z=slot+random()*2-1,x=side*(6.25+random()*.3);
      if(tree){tree.scale.setScalar(.78+random()*.28);tree.position.set(x,-.1,z);tree.rotation.y=random()*6.28;g.add(tree);}
      else{cyl(g,.17,.25,3,x,1.5,z,0x826c51);sphere(g,1.3,x,3.4,z,0x7f9d65,1,1.25,1);}
    }
  }
  // Catenary gantries, suspended signs, and railway cables.
  if(zone!==3)for(const z of [-20,20]){for(const x of [-5.35,5.35]){box(g,.16,11.3,.18,x,5.65,z,0x5e7d7c);box(g,.45,.2,.55,x,.1,z,0x71827d);}box(g,11,.14,.18,0,11.2,z,0x5e7d7c);for(const x of [-3.25,0,3.25]){box(g,.035,.6,.035,x,10.9,z,0x466867);cyl(g,.10,.10,.23,x,10.65,z,0xceb48b);}}
  for(const x of [-3.25,0,3.25])box(g,.018,.018,length,x,10.55,0,0x668785);
  // Signals sit at 5.2, not the old 4.4: the kit head is far chunkier than the
  // thin procedural post it replaced and at 4.4 it reached into the volume the
  // trains sweep. See work/build/layout-check.mjs.
  // The station sign keeps its rendered typography; only the signal posts are
  // swapped for the kit's, which carry a full three-lamp head for fewer
  // triangles than the two spheres they replace.
  if(index%3===0){if(zone!==3)box(g,3.7,.75,.10,0,10,-20,signs.station);
    for(const x of [-5.2,5.2]){const signal=cityModel('traffic-light');
      if(signal){signal.scale.setScalar(6);signal.position.set(x,-.1,-12);signal.rotation.y=-Math.sign(x)*Math.PI/2;g.add(signal);}
      else{cyl(g,.06,.06,2.9,x,1.45,-12,0x4f7472);box(g,.3,.8,.26,x,2.8,-12,0x274b53,true);sphere(g,.08,x,3.03,-11.85,mat(0xbaf17c,{emissive:0x98f85b,emissiveIntensity:.9}));sphere(g,.08,x,2.72,-11.85,0x49605b);}}}
  if(index%3===2){const wall=box(g,.2,2.2,8,-7.48,1.1,8,0x237d7a);box(g,.03,1.3,6,-7.36,1.1,8,signs.art);}
  // Houses carry their own textured material, so they join the chunk after the
  // static merge instead of being baked into it.
  addRailArchitecture(g,index,{T,box,cyl,sphere,mat,signTexture});
  const chunk=staticBatch(g);for(const house of houses)chunk.add(house);return chunk;
}
export function shadowTexture(){const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d'),r=ctx.createRadialGradient(32,32,2,32,32,31);r.addColorStop(0,'rgba(15,37,42,.4)');r.addColorStop(1,'rgba(15,37,42,0)');ctx.fillStyle=r;ctx.fillRect(0,0,64,64);return new T.CanvasTexture(c);}
