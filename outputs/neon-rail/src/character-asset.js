import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import kidData from '../assets/meridian-kid.glb';
// Matches the procedural courier this replaces (2.52m to the top of its cap),
// so the character keeps the presence the camera framing was built around. It
// is deliberately taller than the 1.98m standing silhouette the collision maths
// uses -- the old courier was too, and the gap only ever shows while the player
// is already being hit.
export const CHARACTER_HEIGHT=2.5;
// The run clip is authored at roughly this pace, so playback is scaled against
// it and the feet keep up with the ground instead of skating.
const RUN_REFERENCE_SPEED=17;
let source=null;
export async function prepareCharacterAsset(){
  source=await new GLTFLoader().loadAsync(kidData);
}
// One character exists at a time, so the loaded scene is used directly rather
// than cloned -- cloning a skinned mesh needs the skeleton rebuilt to match.
export function characterModel(){
  if(!source)return null;
  const model=source.scene;
  model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;
    // The bounding sphere of a skinned mesh does not follow the pose, so a
    // crouching slide can cull the character right in front of the camera.
    o.frustumCulled=false;
    if(o.material.map)o.material.map.anisotropy=4;}});
  const inner=new T.Group();inner.add(model);
  const raw=new T.Box3().setFromObject(model);
  inner.scale.setScalar(CHARACTER_HEIGHT/(raw.max.y-raw.min.y));
  inner.updateMatrixWorld(true);
  // Feet on the ground: the game positions the character by its base.
  inner.position.y=-new T.Box3().setFromObject(inner).min.y;
  // Mixamo characters face +Z; the runner runs toward -Z, away from the camera.
  inner.rotation.y=Math.PI;
  const root=new T.Group();root.name='Meridian Kid';root.add(inner);

  const mixer=new T.AnimationMixer(model);
  const clips=Object.fromEntries(source.animations.map(a=>[a.name,a]));
  let current=null,currentName='';
  function play(name,options){
    const {loop=true,fade=.16,hold=false,speed=1}=options||{};
    const clip=clips[name];
    if(!clip||name===currentName){if(current)current.timeScale=speed;return;}
    const next=mixer.clipAction(clip);
    next.reset();
    next.setLoop(loop?T.LoopRepeat:T.LoopOnce,Infinity);
    next.clampWhenFinished=hold;
    next.timeScale=speed;
    next.setEffectiveWeight(1);
    if(current)current.fadeOut(fade);
    next.fadeIn(fade).play();
    current=next;currentName=name;
  }
  // Picks the clip from player state. Ordering is priority: the reactions have
  // to win over the locomotion underneath them.
  function pose(state,player,power,time,speed,glance,captureTime=0){
    if(state==='menu'){
      // Both dance clips belong to the start screen; they alternate so the menu
      // does not loop one four-second clip forever.
      play(Math.floor(time/9)%2?'danceB':'danceA',{fade:.4});
    }
    else if(state==='idle'){play('land',{loop:false,hold:true,fade:.2,speed:0});if(currentName==='land')current.time=Math.max(0,current.getClip().duration-.001);}
    else if(state==='caught')play(captureTime<1.8?'lookBack':captureTime<2.9?'stumble':'fall',{loop:captureTime<1.8,hold:true,fade:.18,speed:captureTime<1.8?.35:.65});
    else if(state==='over')play('stumble',{loop:false,hold:true,fade:.12});
    else if(player.stumble>0)play('stumble',{loop:false,hold:true,fade:.1});
    else if(power.board>0)play('board',{speed:1});
    else if(player.slide>0)play('slide',{loop:false,hold:true,fade:.08});
    else if(!player.grounded)play(player.vy>0?'jump':'fall',{loop:false,hold:true,fade:.1});
    else if(player.land>.55)play('land',{loop:false,hold:true,fade:.08});
    // A near miss throws a glance over the shoulder. It sits just above plain
    // running so a jump, slide or hit still takes priority, and it loops
    // because the clip is a run cycle with the head turned.
    else if(glance>0)play('lookBack',{speed:Math.max(.6,speed/RUN_REFERENCE_SPEED),fade:.12});
    else play('run',{speed:Math.max(.6,speed/RUN_REFERENCE_SPEED)});
  }
  return {root,mixer,play,pose,update:dt=>mixer.update(dt)};
}
