// Builds the player character from Mixamo's FBX exports.
//
// Each FBX carries a full copy of the same skinned character plus one clip, so
// converting them naively would ship eleven 12MB characters. This keeps ONE
// master mesh and skeleton and merges every clip onto it, matching channels by
// bone NAME rather than node index so the merge survives any re-ordering.
//
// Root motion is stripped: the runner's own code owns the character's position,
// and a clip that also translates the hips would fight it, walking the character
// off its gameplay root over time.
// Prerequisite: convert the Mixamo FBX exports to glTF first. Those
// intermediates are ~135MB and fully reproducible, so they are not kept:
//
//   SC=work/build/node_modules/fbx2gltf/bin/Windows_NT/FBX2glTF.exe
//   mkdir -p work/build/fbx-out
//   for f in "work/main character"/*.fbx; do
//     "$SC" -i "$f" -o "work/build/fbx-out/$(basename "$f" .fbx)" --binary
//   done
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import sharp from 'sharp';
import {MeshoptSimplifier as S} from 'meshoptimizer';
await S.ready;

const DIR='work/build/fbx-out/';
const BASE='Fast Run.glb';
const TARGET_TRIANGLES=11000,TEXTURE_SIZE=512;
// File name -> the name the game asks for. Mixamo calls every clip "mixamo.com".
const CLIPS={
  'Fast Run':'run','Jump':'jump','Big Jump':'bigJump','Falling To Landing':'fall',
  'Hard Landing':'land','Running Slide':'slide','Stumble Backwards':'stumble',
  'Skateboarding':'board','Run Look Back':'lookBack',
  'Hip Hop Dancing':'danceA','Silly Dancing':'danceB',
};

const C={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
const TY={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
function open(file){const b=readFileSync(DIR+file),l=b.readUInt32LE(12);
  return {j:JSON.parse(b.toString('utf8',20,20+l)),bin:b.subarray(28+l)};}
function read(j,bin,ai){const a=j.accessors[ai],v=j.bufferViews[a.bufferView],T=TY[a.componentType];
  const s=(v.byteOffset||0)+(a.byteOffset||0);
  return new T(Uint8Array.from(bin.subarray(s,s+a.count*C[a.type]*T.BYTES_PER_ELEMENT)).buffer);}

const {j:base,bin:baseBin}=open(BASE);
const prim=base.meshes[0].primitives[0];
const pos=read(base,baseBin,prim.attributes.POSITION);
const nrm=read(base,baseBin,prim.attributes.NORMAL);
const uv=read(base,baseBin,prim.attributes.TEXCOORD_0);
const joints=read(base,baseBin,prim.attributes.JOINTS_0);
const weights=read(base,baseBin,prim.attributes.WEIGHTS_0);
const indices=read(base,baseBin,prim.indices);
const vertexCount=base.accessors[prim.attributes.POSITION].count;

// Simplify on position + uv + normal. Skin data is deliberately not part of the
// error metric: compactMesh picks representative vertices rather than blending
// them, so joints and weights carry across intact.
const attributes=new Float32Array(vertexCount*5);
for(let i=0;i<vertexCount;i++)
  attributes.set([uv[i*2],uv[i*2+1],nrm[i*3]*.2,nrm[i*3+1]*.2,nrm[i*3+2]*.2],i*5);
const [reduced,error]=S.simplifyWithAttributes(
  indices,pos,3,attributes,5,[.7,.7,.2,.2,.2],null,TARGET_TRIANGLES*3,.4,['Permissive']);
const [remap,count]=S.compactMesh(reduced);

const kept={pos:new Float32Array(count*3),nrm:new Float32Array(count*3),uv:new Float32Array(count*2),
  joints:new Uint16Array(count*4),weights:new Float32Array(count*4)};
for(let i=0;i<vertexCount;i++){const to=remap[i];if(to===0xffffffff)continue;
  kept.pos.set(pos.subarray(i*3,i*3+3),to*3);
  kept.nrm.set(nrm.subarray(i*3,i*3+3),to*3);
  kept.uv.set(uv.subarray(i*2,i*2+2),to*2);
  kept.joints.set(joints.subarray(i*4,i*4+4),to*4);
  // Re-normalise: a surviving vertex must still have weights summing to 1.
  const w=Array.from(weights.subarray(i*4,i*4+4)),sum=w.reduce((a,b)=>a+b,0)||1;
  kept.weights.set(w.map(v=>v/sum),to*4);}

const image=base.images[0],iv=base.bufferViews[image.bufferView];
const texture=await sharp(Buffer.from(baseBin.subarray(iv.byteOffset||0,(iv.byteOffset||0)+iv.byteLength)))
  .resize(TEXTURE_SIZE,TEXTURE_SIZE).jpeg({quality:86,mozjpeg:true}).toBuffer();

const chunks=[],views=[];let offset=0;
function append(data,target){const b=Buffer.from(data),view={buffer:0,byteOffset:offset,byteLength:b.length};
  if(target)view.target=target;views.push(view);chunks.push(b);offset+=b.length;
  const pad=(4-offset%4)%4;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}return views.length-1;}

const accessors=[];
function accessor(data,type,componentType,target,extra){
  return accessors.push({bufferView:append(Buffer.from(data.buffer,data.byteOffset,data.byteLength),target),
    componentType,count:data.length/C[type],type,...(extra||{})})-1;}

const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
for(let i=0;i<kept.pos.length;i++){const c=i%3;lo[c]=Math.min(lo[c],kept.pos[i]);hi[c]=Math.max(hi[c],kept.pos[i]);}
const A={
  POSITION:accessor(kept.pos,'VEC3',5126,34962,{min:lo,max:hi}),
  NORMAL:accessor(kept.nrm,'VEC3',5126,34962),
  TEXCOORD_0:accessor(kept.uv,'VEC2',5126,34962),
  JOINTS_0:accessor(kept.joints,'VEC4',5123,34962),
  WEIGHTS_0:accessor(kept.weights,'VEC4',5126,34962),
};
const small=count<=65535,ix=small?Uint16Array.from(reduced):reduced;
const indexAccessor=accessor(ix,'SCALAR',small?5123:5125,34963);
const ibmAccessor=accessor(Float32Array.from(read(base,baseBin,base.skins[0].inverseBindMatrices)),'MAT4',5126);

// Nodes come across verbatim so the skeleton, its bind pose and the skin's joint
// list stay consistent with the inverse bind matrices.
const nodes=base.nodes.map(n=>({...n}));
const byName=new Map(nodes.map((n,i)=>[n.name,i]));
for(const n of nodes)if(n.mesh!==undefined)n.mesh=0;

const animations=[],report=[];
for(const file of readdirSync(DIR).filter(f=>f.endsWith('.glb')).sort()){
  const stem=file.replace('.glb',''),name=CLIPS[stem];
  if(!name){report.push({clip:stem,skipped:'unmapped'});continue;}
  const {j:src,bin:srcBin}=open(file);
  const anim=src.animations[0];
  const samplers=[],channels=[];let stripped=0,hipSpan=[0,0,0];
  for(const ch of anim.channels){
    const target=byName.get(src.nodes[ch.target.node]?.name);
    if(target===undefined)continue;
    if(ch.target.path==='translation'&&/Hips$/.test(nodes[target].name)){
      const v=read(src,srcBin,anim.samplers[ch.sampler].output),n=v.length/3;
      hipSpan=[0,1,2].map(c=>{let mn=1e9,mx=-1e9;
        for(let i=0;i<n;i++){mn=Math.min(mn,v[i*3+c]);mx=Math.max(mx,v[i*3+c]);}return +(mx-mn).toFixed(5);});
      stripped++;continue;}
    if(ch.target.path==='scale')continue;   // bind-pose scale already sits on the node
    const s=anim.samplers[ch.sampler];
    const input=read(src,srcBin,s.input),output=read(src,srcBin,s.output);
    const si=samplers.push({
      input:accessor(Float32Array.from(input),'SCALAR',5126,undefined,{min:[input[0]],max:[input[input.length-1]]}),
      output:accessor(Float32Array.from(output),ch.target.path==='rotation'?'VEC4':'VEC3',5126),
      interpolation:s.interpolation||'LINEAR'})-1;
    channels.push({sampler:si,target:{node:target,path:ch.target.path}});
  }
  animations.push({name,samplers,channels});
  const t=read(src,srcBin,anim.samplers[anim.channels[0].sampler].input);
  report.push({clip:stem,name,channels:channels.length,seconds:+t[t.length-1].toFixed(2),
    rootStripped:stripped,hipSpanStripped:hipSpan});
}

const out={asset:{version:'2.0',generator:'neon-rail character packer'},scene:0,
  scenes:base.scenes,nodes,
  meshes:[{name:'meridian_kid',primitives:[{attributes:A,indices:indexAccessor,material:0}]}],
  skins:[{...base.skins[0],inverseBindMatrices:ibmAccessor}],
  materials:[{name:'kid',doubleSided:false,
    pbrMetallicRoughness:{baseColorTexture:{index:0},metallicFactor:0,roughnessFactor:.85}}],
  textures:[{sampler:0,source:0}],images:[{mimeType:'image/jpeg',bufferView:append(texture)}],
  samplers:[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}],
  animations,accessors,bufferViews:views,buffers:[{byteLength:offset}]};
let json=Buffer.from(JSON.stringify(out));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const binary=Buffer.concat(chunks),header=Buffer.alloc(20),bh=Buffer.alloc(8);
header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);
header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
bh.writeUInt32LE(binary.length,0);bh.writeUInt32LE(0x004e4942,4);
const glb=Buffer.concat([header,json,bh,binary]);
writeFileSync('outputs/neon-rail/assets/meridian-kid.glb',glb);
console.log(JSON.stringify({originalTriangles:indices.length/3,triangles:reduced.length/3,vertices:count,
  error:+error.toFixed(5),bindSize:hi.map((v,i)=>+(v-lo[i]).toFixed(4)),bones:base.skins[0].joints.length,
  textureKB:Math.round(texture.length/1024),totalKB:Math.round(glb.length/1024),clips:report},null,1));
