// Packs a chosen subset of Kenney's City Kit Roads into one GLB for the game.
// Same technique as the track tiles: the kit's colormap is flat swatches, so
// rather than ship a texture we split each model by swatch and recolour it into
// the game's palette (see kit-palette.mjs). Parts that land on the same game
// colour are merged, which is what keeps the material -- and therefore the draw
// call -- count down once the pieces join a chunk's static batch.
import {readFileSync,writeFileSync} from 'node:fs';
import sharp from 'sharp';
import {recolour} from './kit-palette.mjs';

const SOURCE='work/kenney_city-kit-roads/Models/GLB format/';
// Each entry is {file, overrides?} -- overrides steer a colour family for that
// one model (see kit-palette.mjs). Each becomes one named node.
const MODELS=JSON.parse(process.argv[2]||'[]').map(m=>typeof m==='string'?{file:m}:m);

const {data:atlas,info}=await sharp(SOURCE+'Textures/colormap.png').raw().toBuffer({resolveWithObject:true});
// glTF puts UV (0,0) at the image's TOP-left, so v maps straight to the row.
function swatch(u,v){
  const x=Math.min(info.width-1,Math.max(0,Math.round(u*info.width-.5)));
  const y=Math.min(info.height-1,Math.max(0,Math.round(v*info.height-.5)));
  const i=(y*info.width+x)*info.channels;
  return '#'+[atlas[i],atlas[i+1],atlas[i+2]].map(c=>c.toString(16).padStart(2,'0')).join('');
}
const C={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
const TYPES={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};

const chunks=[],views=[],accessors=[],meshes=[],nodes=[],materials=[],matIndex=new Map();
let offset=0;
function append(data,target){const b=Buffer.from(data),view={buffer:0,byteOffset:offset,byteLength:b.length};
  if(target)view.target=target;views.push(view);chunks.push(b);offset+=b.length;
  const pad=(4-offset%4)%4;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}return views.length-1;}
// glTF baseColorFactor is LINEAR, but the palette is authored in sRGB like the
// rest of the game's colours, so it has to be converted or everything renders
// noticeably dark.
const toLinear=v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);
function material(colour){
  if(!matIndex.has(colour)){const name='c'+colour.toString(16).padStart(6,'0');
    matIndex.set(colour,materials.length);
    materials.push({name,pbrMetallicRoughness:{metallicFactor:0,roughnessFactor:.75,
      baseColorFactor:[...[16,8,0].map(sh=>toLinear(((colour>>sh)&255)/255)),1]}});}
  return matIndex.get(colour);}

const report=[];
for(const {file,overrides} of MODELS){
  const buf=readFileSync(SOURCE+file);
  const jl=buf.readUInt32LE(12),j=JSON.parse(buf.toString('utf8',20,20+jl)),bin=buf.subarray(28+jl);
  const read=ai=>{const a=j.accessors[ai],v=j.bufferViews[a.bufferView],T=TYPES[a.componentType];
    const s=(v.byteOffset||0)+(a.byteOffset||0),n=a.count*C[a.type]*T.BYTES_PER_ELEMENT;
    return new T(Uint8Array.from(bin.subarray(s,s+n)).buffer);};

  // Gather every triangle from every node, baking node translation in, and
  // bucket by the game colour its swatch maps to.
  const buckets=new Map();
  for(const node of j.nodes||[]){
    if(node.mesh===undefined)continue;
    const t=node.translation||[0,0,0];
    for(const prim of j.meshes[node.mesh].primitives){
      const pos=read(prim.attributes.POSITION),nrm=read(prim.attributes.NORMAL),idx=read(prim.indices);
      const uv=read(prim.attributes.TEXCOORD_0);
      for(let k=0;k<idx.length;k+=3){
        const colour=recolour(swatch(uv[idx[k]*2],uv[idx[k]*2+1]),overrides);
        let b=buckets.get(colour);
        if(!b)buckets.set(colour,b={position:[],normal:[],index:[],seen:new Map()});
        for(const v of [idx[k],idx[k+1],idx[k+2]]){
          const key=v+'@'+t.join(',');
          if(!b.seen.has(key)){b.seen.set(key,b.position.length/3);
            b.position.push(pos[v*3]+t[0],pos[v*3+1]+t[1],pos[v*3+2]+t[2]);
            b.normal.push(nrm[v*3],nrm[v*3+1],nrm[v*3+2]);}
          b.index.push(b.seen.get(key));}
      }
    }
  }
  // Re-seat every model on its own footprint: base on y=0, centred in x/z, so
  // placement in the world is a plain scale with no compensating offsets.
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const b of buckets.values())for(let i=0;i<b.position.length;i++){
    const c=i%3;min[c]=Math.min(min[c],b.position[i]);max[c]=Math.max(max[c],b.position[i]);}
  const shift=[-(min[0]+max[0])/2,-min[1],-(min[2]+max[2])/2];

  const primitives=[];let triangles=0;
  for(const [colour,b] of buckets){
    for(let i=0;i<b.position.length;i++)b.position[i]+=shift[i%3];
    const p=Float32Array.from(b.position),n=Float32Array.from(b.normal);
    // UVs are unused by these flat materials, but BufferGeometryUtils only
    // merges geometries whose attribute sets match, and the scenery boxes these
    // batch with all carry one.
    const uv=new Float32Array((p.length/3)*2);
    const ix=p.length/3<=65535?Uint16Array.from(b.index):Uint32Array.from(b.index);
    const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<p.length;i++){const c=i%3;lo[c]=Math.min(lo[c],p[i]);hi[c]=Math.max(hi[c],p[i]);}
    const base=accessors.length;
    accessors.push({bufferView:append(Buffer.from(p.buffer),34962),componentType:5126,count:p.length/3,type:'VEC3',min:lo,max:hi},
      {bufferView:append(Buffer.from(n.buffer),34962),componentType:5126,count:n.length/3,type:'VEC3'},
      {bufferView:append(Buffer.from(uv.buffer),34962),componentType:5126,count:uv.length/2,type:'VEC2'},
      {bufferView:append(Buffer.from(ix.buffer),34963),componentType:ix.BYTES_PER_ELEMENT===2?5123:5125,count:ix.length,type:'SCALAR'});
    primitives.push({attributes:{POSITION:base,NORMAL:base+1,TEXCOORD_0:base+2},indices:base+3,material:material(colour)});
    triangles+=ix.length/3;
  }
  const name=file.replace(/\.glb$/,'');
  nodes.push({mesh:meshes.length,name});meshes.push({name,primitives});
  report.push({model:name,triangles,materials:buckets.size,
    size:max.map((v,i)=>+(v-min[i]).toFixed(3))});
}

const out={asset:{version:'2.0',generator:'neon-rail city kit packer'},scene:0,
  scenes:[{nodes:nodes.map((n,i)=>i)}],nodes,meshes,materials,accessors,bufferViews:views,buffers:[{byteLength:offset}]};
let json=Buffer.from(JSON.stringify(out));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const binary=Buffer.concat(chunks),header=Buffer.alloc(20),bh=Buffer.alloc(8);
header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);
header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
bh.writeUInt32LE(binary.length,0);bh.writeUInt32LE(0x004e4942,4);
const glb=Buffer.concat([header,json,bh,binary]);
writeFileSync('outputs/neon-rail/assets/meridian-city.glb',glb);
console.log(JSON.stringify({models:report,distinctMaterials:materials.length,
  totalTriangles:report.reduce((a,r)=>a+r.triangles,0),totalKB:+(glb.length/1024).toFixed(1)},null,1));
