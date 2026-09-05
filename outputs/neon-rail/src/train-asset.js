import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import trainData from '../assets/meridian-train.glb';
import rampData from '../assets/meridian-ramp-train.glb';
import {TRAIN_ROOF} from './core.js';
let template,rampTemplate;
// Every train fills the same volume whatever the model: the collision tests read
// TRAIN_ROOF and TRAIN_HALF, so a rover sitting any lower or shorter would stop
// matching the rules the player is judged against.
async function fitted(data,name,turn=0){
  const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer,'');
  const model=gltf.scene;
  // Meshy's longest axis is X; the runner's rail direction is Z. The extra half
  // turn is for the rover, whose nose was clipped off along with its built-in
  // ramp: the open cut has to face away from the player, not toward them.
  model.rotation.y=Math.PI/2+turn;model.updateMatrixWorld(true);
  let bounds=new T.Box3().setFromObject(model),size=bounds.getSize(new T.Vector3());
  const group=new T.Group();group.add(model);
  group.scale.set(2.65/size.x,TRAIN_ROOF/size.y,13.2/size.z);
  group.updateMatrixWorld(true);bounds=new T.Box3().setFromObject(group);
  group.position.set(-(bounds.min.x+bounds.max.x)/2,-bounds.min.y,-(bounds.min.z+bounds.max.z)/2);
  group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;
    const mats=Array.isArray(o.material)?o.material:[o.material];
    for(const m of mats){if(m.map)m.map.anisotropy=4;}}});
  const root=new T.Group();root.name=name;root.add(group);return root;
}
export async function prepareTrainAsset(){
  [template,rampTemplate]=await Promise.all([
    fitted(trainData,'Meshy Meridian Train'),
    fitted(rampData,'Meshy Metro Ramp Rover',Math.PI),
  ]);
}
export function importedTrain(){return template?.clone(true);}
export function importedRampTrain(){return rampTemplate?.clone(true);}
