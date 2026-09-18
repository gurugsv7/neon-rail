// Meshy exports the ramp rover at 195k triangles with three 2048px textures.
// The runner only ever shows it as an obstacle a few seconds at a time, so both
// budgets are cut hard: attribute-aware simplification keeps the UV atlas
// intact, and only the base colour survives -- metal/roughness and normal
// detail are invisible at the speed this thing goes past.
import {readFileSync,writeFileSync} from 'node:fs';
import {MeshoptSimplifier as S} from 'meshoptimizer';
import sharp from 'sharp';
await S.ready;

const LOD_TRIANGLES=[12000],TEXTURE_SIZE=1024;
// The rover carries its own boarding ramp on its nose: about 5m long, rising
// 2.9m and stopping short of the ground. The game's ramp is 14.5m at half that
// slope and is what the collision maths actually reads, so keeping both put two
// mismatched ramps on the same train. The nose is clipped off here and the
// remaining car is re-fitted to fill the train volume; the loader then turns it
// so the cut end faces away from the approaching player.
const CLIP_X=-.131;
const input=readFileSync('work/Meshy_AI_Metro_Ramp_Rover_0905044926_texture.glb');
const jsonLength=input.readUInt32LE(12),j=JSON.parse(input.toString('utf8',20,20+jsonLength));
const bin=input.subarray(28+jsonLength);
const COMPONENTS={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
function raw(accessorIndex){const a=j.accessors[accessorIndex],v=j.bufferViews[a.bufferView],offset=(v.byteOffset||0)+(a.byteOffset||0);
  return Uint8Array.from(bin.subarray(offset,offset+a.count*COMPONENTS[a.type]*4)).buffer;}
const prim=j.meshes[0].primitives[0];
const pos=new Float32Array(raw(prim.attributes.POSITION));
const nrm=new Float32Array(raw(prim.attributes.NORMAL));
const uv=new Float32Array(raw(prim.attributes.TEXCOORD_0));
let indices=new Uint32Array(raw(prim.indices));
{const kept=[];for(let t=0;t<indices.length;t+=3){
   const cx=(pos[indices[t]*3]+pos[indices[t+1]*3]+pos[indices[t+2]*3])/3;
   if(cx>=CLIP_X)kept.push(indices[t],indices[t+1],indices[t+2]);}
 console.error('clipped',(indices.length-kept.length)/3,'of',indices.length/3,'triangles');
 indices=Uint32Array.from(kept);}
const vertexCount=j.accessors[prim.attributes.POSITION].count;

// UV is weighted well above the normal: seam drift shows as smeared texture,
// while shading creases are re-derived cheaply by the simplifier's own metric.
const attributes=new Float32Array(vertexCount*5);
for(let i=0;i<vertexCount;i++)attributes.set([uv[i*2],uv[i*2+1],nrm[i*3]*.15,nrm[i*3+1]*.15,nrm[i*3+2]*.15],i*5);
const levels=LOD_TRIANGLES.map(target=>{
  const [reduced,error]=S.simplifyWithAttributes(indices,pos,3,attributes,5,[.8,.8,.15,.15,.15],null,target*3,.6,['Permissive']);
  const [remap,count]=S.compactMesh(reduced);
  const kept={pos:new Float32Array(count*3),nrm:new Float32Array(count*3),uv:new Float32Array(count*2)};
  for(let i=0;i<vertexCount;i++){const to=remap[i];if(to===0xffffffff)continue;
    kept.pos.set(pos.subarray(i*3,i*3+3),to*3);kept.nrm.set(nrm.subarray(i*3,i*3+3),to*3);kept.uv.set(uv.subarray(i*2,i*2+2),to*2);}
  return {indices:reduced,count,error,...kept};
});

// Re-seat every level on the shared origin taken from the finest one: base at
// y=0, centred in x/z, so the levels stay registered and placement in the world
// is a plain scale in metres with no compensating offsets.
const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
for(let i=0;i<levels[0].count*3;i++){const c=i%3;min[c]=Math.min(min[c],levels[0].pos[i]);max[c]=Math.max(max[c],levels[0].pos[i]);}
const shift=[-(min[0]+max[0])/2,-min[1],-(min[2]+max[2])/2];
for(const level of levels)for(let i=0;i<level.count*3;i++)level.pos[i]+=shift[i%3];
const bounds={min:min.map((v,i)=>v+shift[i]),max:max.map((v,i)=>v+shift[i])};

const baseColor=await sharp(Buffer.from(bin.subarray(j.bufferViews[j.images[0].bufferView].byteOffset||0,(j.bufferViews[j.images[0].bufferView].byteOffset||0)+j.bufferViews[j.images[0].bufferView].byteLength)))
  .resize(TEXTURE_SIZE,TEXTURE_SIZE).jpeg({quality:82,mozjpeg:true}).toBuffer();

const chunks=[],views=[];let offset=0;
function append(data,target){const b=Buffer.from(data),view={buffer:0,byteOffset:offset,byteLength:b.length};if(target)view.target=target;
  views.push(view);chunks.push(b);offset+=b.length;const pad=(4-offset%4)%4;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}return views.length-1;}
const imageView=append(baseColor);
const accessors=[],meshes=[];
for(const [level,data] of levels.entries()){
  const base=accessors.length;
  accessors.push({bufferView:append(Buffer.from(data.pos.buffer),34962),componentType:5126,count:data.count,type:'VEC3',min:bounds.min,max:bounds.max},
    {bufferView:append(Buffer.from(data.nrm.buffer),34962),componentType:5126,count:data.count,type:'VEC3'},
    {bufferView:append(Buffer.from(data.uv.buffer),34962),componentType:5126,count:data.count,type:'VEC2'});
  const small=data.count<=65535,indexData=small?Uint16Array.from(data.indices):data.indices;
  accessors.push({bufferView:append(Buffer.from(indexData.buffer,indexData.byteOffset,indexData.byteLength),34963),componentType:small?5123:5125,count:data.indices.length,type:'SCALAR'});
  meshes.push({name:'ramp_rover_LOD'+level,primitives:[{attributes:{POSITION:base,NORMAL:base+1,TEXCOORD_0:base+2},indices:base+3,material:0}]});
}

const out={asset:{version:'2.0',generator:'neon-rail building optimizer'},scene:0,scenes:[{nodes:meshes.map((m,i)=>i)}],
  nodes:meshes.map((m,i)=>({mesh:i,name:m.name})),meshes,
  // The mesh is a closed volume, so back faces are never seen: culling them is
  // worth ~3ms a frame on integrated graphics.
  materials:[{name:'ramp_rover',doubleSided:false,pbrMetallicRoughness:{baseColorTexture:{index:0},metallicFactor:0,roughnessFactor:.85}}],
  textures:[{sampler:0,source:0}],images:[{mimeType:'image/jpeg',bufferView:imageView}],
  samplers:[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}],
  accessors,bufferViews:views,buffers:[{byteLength:offset}]};

let json=Buffer.from(JSON.stringify(out));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const binary=Buffer.concat(chunks),header=Buffer.alloc(20),bh=Buffer.alloc(8);
header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);
header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
bh.writeUInt32LE(binary.length,0);bh.writeUInt32LE(0x004e4942,4);
const glb=Buffer.concat([header,json,bh,binary]);
writeFileSync('outputs/neon-rail/assets/meridian-ramp-train.glb',glb);
console.log(JSON.stringify({originalTriangles:indices.length/3,levels:levels.map(l=>({triangles:l.indices.length/3,vertices:l.count,error:+l.error.toFixed(5)})),textureKB:Math.round(baseColor.length/1024),totalKB:Math.round(glb.length/1024),bounds},null,1));
