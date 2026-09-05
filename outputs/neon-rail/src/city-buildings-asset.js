import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import buildingData from '../assets/meridian-city-buildings.glb';
// Kenney authors the kit against 1-unit road tiles; this puts the street's
// frontage between roughly 6m and 22m tall, which keeps the canyon the
// procedural blocks used to give while letting the kit's own size variety show.
export const BUILDING_SCALE=7;
// The kit's walls are near-white, so a material colour multiplier re-tints a
// whole building while its dark roofs and window glass stay dark. One geometry
// therefore serves every colourway in the street.
// The first BUILDING_TINTS are the street's colourways, picked at random per
// building. The two after them are for shipping containers, which want a
// stronger colour than any facade should have.
export const BUILDING_TINTS=8;
const TINTS=[0xf4e5c6,0xeec9a0,0xe8a887,0xbfd0c4,0xa8c3c6,0xd9b9a3,0xcfd8d2,0xf0d3ad,0xc4674a,0x2f7f7c];
export const CONTAINER_TINT=8;
// Past the fog's far plane a building is solid background colour, so the last
// level draws nothing: the camera reaches 310m but nothing beyond 245m is seen.
const CULL=246;
const models=new Map(),materials=[];
export async function prepareCityBuildingAsset(){
  const bytes=Uint8Array.from(atob(buildingData),c=>c.charCodeAt(0));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer,'');
  gltf.scene.updateMatrixWorld(true);
  let source=null;
  for(const node of gltf.scene.children){
    let mesh=null;node.traverse(o=>{if(o.isMesh&&!mesh)mesh=o;});
    if(!mesh)continue;source=source||mesh.material;
    const geometry=mesh.geometry;geometry.computeBoundingBox();
    const b=geometry.boundingBox;
    models.set(node.name,{geometry,size:[b.max.x-b.min.x,b.max.y-b.min.y,b.max.z-b.min.z]});
  }
  if(!source)return;
  for(const tint of TINTS){const m=source.clone();m.vertexColors=true;m.color.setHex(tint);m.roughness=.82;materials.push(m);}
}
export function buildingNames(prefix){return [...models.keys()].filter(n=>n.startsWith(prefix));}
export function buildingSize(name){const e=models.get(name);return e?e.size.map(v=>v*BUILDING_SCALE):null;}
// One draw call per building: a single primitive carrying vertex colours, with
// the tint chosen per instance. Wrapped in an LOD purely to drop the copies the
// fog has already swallowed.
export function cityBuilding(name,variant){
  const entry=models.get(name);if(!entry||!materials.length)return null;
  const mesh=new T.Mesh(entry.geometry,materials[variant%materials.length]);
  mesh.receiveShadow=true;
  const lod=new T.LOD();lod.addLevel(mesh,0);lod.addLevel(new T.Object3D(),CULL);
  return lod;
}
