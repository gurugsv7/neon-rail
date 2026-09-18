import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import cityData from '../assets/meridian-city.glb';
// The kit's lamp bulbs and signal lenses are the one place a flat colour is not
// enough -- the procedural parts they replace were emissive. Keyed per model on
// purpose: the palette is shared across the whole kit, so the bulb's pale tone
// is also an ordinary metal highlight on the dumpster and must not glow there.
const GLOW={
  'light-curved':{0xb6c3c1:{emissive:0xffdaa2,intensity:.85}},
  'traffic-light':{0x87e71a:{emissive:0x98f85b,intensity:.9},0x75c915:{emissive:0x98f85b,intensity:.9}},
};
const models=new Map();
export async function prepareCityAsset(){
  const gltf=await new GLTFLoader().loadAsync(cityData);
  gltf.scene.updateMatrixWorld(true);
  for(const node of gltf.scene.children){
    const parts=[],glowing=GLOW[node.name]||{};
    node.traverse(o=>{if(!o.isMesh)return;
      const glow=glowing[o.material.color.getHex()];
      if(glow){o.material=o.material.clone();o.material.emissive.setHex(glow.emissive);o.material.emissiveIntensity=glow.intensity;}
      parts.push({geometry:o.geometry,material:o.material});});
    if(parts.length)models.set(node.name,parts);
  }
}
// Pieces share geometry and material with every other copy, so they collapse
// into the chunk's existing static batch and cost no extra draw call.
export function cityModel(name){
  const parts=models.get(name);if(!parts)return null;
  const g=new T.Group();
  for(const {geometry,material} of parts){const m=new T.Mesh(geometry,material);m.receiveShadow=true;g.add(m);}
  return g;
}
