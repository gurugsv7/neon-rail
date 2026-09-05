import {readFileSync,writeFileSync} from 'node:fs';
import {MeshoptSimplifier as S} from 'meshoptimizer';
await S.ready;
const input=readFileSync('C:/Users/gurug/Downloads/Meshy_AI_Meridian_Transit_Conc_0905023348_texture.glb');
const jsonLength=input.readUInt32LE(12),j=JSON.parse(input.toString('utf8',20,20+jsonLength));
const bin=input.subarray(28+jsonLength);
function bytes(a){const v=j.bufferViews[a.bufferView];return bin.subarray((v.byteOffset||0)+(a.byteOffset||0),(v.byteOffset||0)+(a.byteOffset||0)+a.count*({SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type])*4);}
const prim=j.meshes[0].primitives[0];
const pos=new Float32Array(Uint8Array.from(bytes(j.accessors[prim.attributes.POSITION])).buffer);
const indices=new Uint32Array(Uint8Array.from(bytes(j.accessors[prim.indices])).buffer);
const [reduced,error]=S.simplify(indices,pos,3,90000,.008);
const [remap,count]=S.compactMesh(reduced);
const chunks=[],views=[];let offset=0;
function append(data,target){const b=Buffer.from(data);const view={buffer:0,byteOffset:offset,byteLength:b.length};if(target)view.target=target;views.push(view);chunks.push(b);offset+=b.length;const pad=(4-offset%4)%4;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}return views.length-1;}
for(const image of j.images){const v=j.bufferViews[image.bufferView];image.bufferView=append(bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength));}
for(const accessorIndex of Object.values(prim.attributes)){
  const a=j.accessors[accessorIndex],components={VEC2:2,VEC3:3,VEC4:4}[a.type],old=new Float32Array(Uint8Array.from(bytes(a)).buffer),next=new Float32Array(count*components);
  for(let i=0;i<remap.length;i++)if(remap[i]!==0xffffffff)next.set(old.subarray(i*components,(i+1)*components),remap[i]*components);
  a.bufferView=append(Buffer.from(next.buffer),34962);a.byteOffset=0;a.count=count;
  if(a.min){a.min=Array(components).fill(Infinity);a.max=Array(components).fill(-Infinity);for(let i=0;i<next.length;i++){a.min[i%components]=Math.min(a.min[i%components],next[i]);a.max[i%components]=Math.max(a.max[i%components],next[i]);}}
}
const ia=j.accessors[prim.indices];ia.bufferView=append(Buffer.from(reduced.buffer,reduced.byteOffset,reduced.byteLength),34963);ia.byteOffset=0;ia.count=reduced.length;ia.componentType=5125;delete ia.min;delete ia.max;
j.bufferViews=views;j.buffers=[{byteLength:offset}];
let json=Buffer.from(JSON.stringify(j));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const binary=Buffer.concat(chunks),header=Buffer.alloc(20),bh=Buffer.alloc(8);
header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);bh.writeUInt32LE(binary.length,0);bh.writeUInt32LE(0x004e4942,4);
writeFileSync('outputs/neon-rail/assets/meridian-train.glb',Buffer.concat([header,json,bh,binary]));
console.log(JSON.stringify({originalTriangles:indices.length/3,triangles:reduced.length/3,vertices:count,error,bytes:28+json.length+binary.length}));
