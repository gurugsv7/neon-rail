import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import railData from '../assets/meridian-rails.glb';
// Kenney's tiles run 4 units along z with the rails on a 0.70 gauge; the game
// lays its own rails at +/-0.67, so a tile is scaled by the ratio of the two.
export const RAIL_GAUGE=.35,RAIL_TILE_LENGTH=4,RAIL_TILE_HEIGHT=.1;
const variants=[];
export async function prepareRailAsset(){
  const gltf=await new GLTFLoader().loadAsync(railData);
  gltf.scene.updateMatrixWorld(true);
  // The asset stores one node per variant, straight first, damaged second. A
  // multi-primitive mesh arrives as a child per primitive, each keeping the
  // material name that says which palette part it is.
  for(const node of gltf.scene.children){
    const parts=[];node.traverse(o=>{if(o.isMesh)parts.push({part:o.material.name,geometry:o.geometry});});
    if(parts.length)variants.push(parts);
  }
}
// Returns the tile's pieces as {part, geometry}; the caller supplies the colour
// so the pieces merge into the chunk's existing static batch.
export function railTile(damaged){return variants.length?variants[damaged&&variants[1]?1:0]:null;}
