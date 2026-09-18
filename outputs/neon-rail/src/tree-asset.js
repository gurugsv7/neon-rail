import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import treeData from '../assets/meridian-trees.glb';
const models=new Map();
export async function prepareTreeAsset(){
  const gltf=await new GLTFLoader().loadAsync(treeData);
  gltf.scene.updateMatrixWorld(true);
  for(const node of gltf.scene.children){
    const parts=[];
    node.traverse(o=>{if(!o.isMesh)return;
      if(o.material.map){o.material.map.anisotropy=4;o.material.map.colorSpace=T.SRGBColorSpace;}
      parts.push({geometry:o.geometry,material:o.material});});
    if(parts.length)models.set(node.name,parts);
  }
}
export function treeNames(){return [...models.keys()];}
// Every tree shares its bark and leaf material with the others, so a chunk's
// worth merges into two draw calls in staticBatch alongside the rest of it.
export function treeModel(name){
  const parts=models.get(name);if(!parts)return null;
  const g=new T.Group();
  for(const {geometry,material} of parts)g.add(new T.Mesh(geometry,material));
  return g;
}
