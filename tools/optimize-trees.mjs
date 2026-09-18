// Quaternius' stylized tree pack ships .obj/.mtl rather than glTF, so this
// converts the handful the game uses into one GLB.
//
// The leaf textures are alpha-cut cards, which is why these keep real textures
// instead of the vertex-colour treatment the Kenney kits get -- baking them to
// flat colours would turn every leaf cluster into a solid blob. Trees share
// their materials, so a whole chunk's worth still merges down to two draw calls
// in staticBatch.
import {readFileSync,writeFileSync} from 'node:fs';
import sharp from 'sharp';

const SOURCE='work/Textured Stylized Trees - May 2020/Textured Stylized Trees - May 2020/';
// A mix of broadleaf and conifer; enough variety that a street never repeats.
const TREES=['Tree_1','Tree_3','Tree_4','Tree_7','Birch_2','Birch_5','Pine_1','Pine_3'];
// The .mtl files carry no map_Kd, so material names are mapped to textures here.
const TEXTURES={
  Bark:{file:'Tree_Bark.jpg',alpha:false},
  Birch_Bark:{file:'Birch_Bark.png',alpha:false},
  Tree_Leaves:{file:'Tree_Leaves.png',alpha:true},
  Birch_Leaves:{file:'Birch_Leaves_Green.png',alpha:true},
  Pine_Leaves:{file:'Pine_Leaves.png',alpha:true},
};
const TEXTURE_SIZE=256;

function parseObj(text){
  const v=[],vt=[],vn=[],groups=new Map();let current='Bark';
  for(const line of text.split('\n')){
    const p=line.trim().split(/\s+/);
    if(p[0]==='v')v.push([+p[1],+p[2],+p[3]]);
    else if(p[0]==='vt')vt.push([+p[1],+p[2]]);
    else if(p[0]==='vn')vn.push([+p[1],+p[2],+p[3]]);
    else if(p[0]==='usemtl')current=p[1];
    else if(p[0]==='f'){
      if(!groups.has(current))groups.set(current,[]);
      const face=p.slice(1).map(c=>c.split('/').map(n=>n?parseInt(n,10):0));
      // Faces may be quads or n-gons; fan-triangulate.
      for(let i=1;i+1<face.length;i++)groups.get(current).push(face[0],face[i],face[i+1]);
    }
  }
  return {v,vt,vn,groups};
}

const chunks=[],views=[],accessors=[],meshes=[],nodes=[],materials=[],textures=[],images=[];
const materialIndex=new Map(),imageIndex=new Map();let offset=0;
function append(data,target){const b=Buffer.from(data),view={buffer:0,byteOffset:offset,byteLength:b.length};
  if(target)view.target=target;views.push(view);chunks.push(b);offset+=b.length;
  const pad=(4-offset%4)%4;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}return views.length-1;}

async function material(name){
  if(materialIndex.has(name))return materialIndex.get(name);
  const spec=TEXTURES[name];if(!spec)throw new Error('no texture mapped for material '+name);
  if(!imageIndex.has(spec.file)){
    const img=sharp(SOURCE+'Textures/'+spec.file).resize(TEXTURE_SIZE,TEXTURE_SIZE);
    const buf=spec.alpha?await img.png({compressionLevel:9,palette:true}).toBuffer()
                        :await img.jpeg({quality:82,mozjpeg:true}).toBuffer();
    imageIndex.set(spec.file,images.length);
    images.push({mimeType:spec.alpha?'image/png':'image/jpeg',bufferView:append(buf)});
    textures.push({sampler:0,source:images.length-1});
  }
  materialIndex.set(name,materials.length);
  materials.push({name,doubleSided:spec.alpha,
    // Leaf cards are cut with alpha, not blended: MASK keeps them sorting-free.
    ...(spec.alpha?{alphaMode:'MASK',alphaCutoff:.5}:{}),
    pbrMetallicRoughness:{baseColorTexture:{index:imageIndex.get(spec.file)},metallicFactor:0,roughnessFactor:.85}});
  return materialIndex.get(name);
}

const report=[];
for(const name of TREES){
  const {v,vt,vn,groups}=parseObj(readFileSync(SOURCE+'OBJ/'+name+'.obj','utf8'));
  const primitives=[];let triangles=0;
  // Re-seat on the origin: base at y=0, centred in x/z.
  let minY=Infinity,cx=[Infinity,-Infinity],cz=[Infinity,-Infinity];
  for(const p of v){minY=Math.min(minY,p[1]);cx[0]=Math.min(cx[0],p[0]);cx[1]=Math.max(cx[1],p[0]);
    cz[0]=Math.min(cz[0],p[2]);cz[1]=Math.max(cz[1],p[2]);}
  const shift=[-(cx[0]+cx[1])/2,-minY,-(cz[0]+cz[1])/2];
  let height=0;
  for(const [mtl,face] of groups){
    const position=[],normal=[],uv=[],index=[],seen=new Map();
    for(const [vi,ti,ni] of face){
      const key=vi+'/'+ti+'/'+ni;
      if(!seen.has(key)){seen.set(key,position.length/3);
        const p=v[vi-1];position.push(p[0]+shift[0],p[1]+shift[1],p[2]+shift[2]);
        const n=vn[ni-1]||[0,1,0];normal.push(n[0],n[1],n[2]);
        const t=vt[ti-1]||[0,0];uv.push(t[0],1-t[1]);}
      index.push(seen.get(key));}
    const p=Float32Array.from(position),n=Float32Array.from(normal),t=Float32Array.from(uv);
    const small=p.length/3<=65535,ix=small?Uint16Array.from(index):Uint32Array.from(index);
    const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<p.length;i++){const c=i%3;lo[c]=Math.min(lo[c],p[i]);hi[c]=Math.max(hi[c],p[i]);}
    height=Math.max(height,hi[1]);
    const base=accessors.length;
    accessors.push({bufferView:append(Buffer.from(p.buffer),34962),componentType:5126,count:p.length/3,type:'VEC3',min:lo,max:hi},
      {bufferView:append(Buffer.from(n.buffer),34962),componentType:5126,count:n.length/3,type:'VEC3'},
      {bufferView:append(Buffer.from(t.buffer),34962),componentType:5126,count:t.length/2,type:'VEC2'},
      {bufferView:append(Buffer.from(ix.buffer,ix.byteOffset,ix.byteLength),34963),componentType:small?5123:5125,count:ix.length,type:'SCALAR'});
    primitives.push({attributes:{POSITION:base,NORMAL:base+1,TEXCOORD_0:base+2},indices:base+3,material:await material(mtl)});
    triangles+=ix.length/3;
  }
  nodes.push({mesh:meshes.length,name});meshes.push({name,primitives});
  report.push({tree:name,triangles,height:+height.toFixed(2)});
}

const out={asset:{version:'2.0',generator:'neon-rail tree packer'},scene:0,
  scenes:[{nodes:nodes.map((n,i)=>i)}],nodes,meshes,materials,textures,images,
  samplers:[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}],
  accessors,bufferViews:views,buffers:[{byteLength:offset}]};
let json=Buffer.from(JSON.stringify(out));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const binary=Buffer.concat(chunks),header=Buffer.alloc(20),bh=Buffer.alloc(8);
header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);
header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
bh.writeUInt32LE(binary.length,0);bh.writeUInt32LE(0x004e4942,4);
const glb=Buffer.concat([header,json,bh,binary]);
writeFileSync('outputs/neon-rail/assets/meridian-trees.glb',glb);
console.log(JSON.stringify({trees:report,materials:materials.length,images:images.length,
  totalTriangles:report.reduce((a,r)=>a+r.triangles,0),totalKB:+(glb.length/1024).toFixed(1)},null,1));
