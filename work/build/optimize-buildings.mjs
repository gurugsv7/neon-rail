// Packs Kenney's City Kit (Commercial) as the game's trackside buildings.
//
// These models sample the kit's flat-swatch colormap, so instead of a texture
// each triangle's colour is baked into a VERTEX COLOUR. That collapses a
// building of ~50 swatches into ONE primitive with ONE material -- a single
// draw call each -- and, because the kit's walls are near-white, the material's
// colour multiplier then re-tints a whole building at no cost. Dark roofs and
// window glass stay dark under the same multiply, so one geometry serves every
// colourway in the street.
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import sharp from 'sharp';

// Two kits share one packed asset: the commercial street frontage and the
// industrial pieces that suit a rail corridor. Names are prefixed so the game
// can draw from either set. Each kit has its own colormap, so the atlas is
// loaded per kit rather than once.
const KITS=[
  {prefix:'com-',dir:'work/kenney_city-kit-commercial_2.1/Models/GLB format/',
   keep:f=>!f.startsWith('detail-')},
  {prefix:'ind-',dir:'work/kenney_city-kit-industrial_2.0/Models/GLB format/',
   keep:f=>/^(building-|shipping-container-|water-tower|chimney-(large|medium)|detail-tank-large)/.test(f)},
];
// Walls must stay close to neutral or the per-instance tint fights the swatch's
// own hue; lightness is kept in full because it is the model's shading.
const DESATURATE=.22;

let atlas,info;
// glTF puts UV (0,0) at the image's TOP-left, so v maps straight to the row.
function swatch(u,v){
  const x=Math.min(info.width-1,Math.max(0,Math.round(u*info.width-.5)));
  const y=Math.min(info.height-1,Math.max(0,Math.round(v*info.height-.5)));
  const i=(y*info.width+x)*info.channels;return [atlas[i],atlas[i+1],atlas[i+2]];
}
// The atlas columns are gradients, so one wall shows up as a dozen shades that
// differ by a step or two. Quantising collapses them, which matters a lot here:
// vertices are split per triangle-colour, so fewer distinct colours means far
// fewer duplicated vertices -- it cuts the packed size roughly in half.
const QUANTISE=12;
function neutralise([r,g,b]){
  const max=Math.max(r,g,b)/255,min=Math.min(r,g,b)/255,l=(max+min)/2;
  return [r,g,b].map(c=>{const n=255*(l+(c/255-l)*DESATURATE);
    return Math.min(255,Math.round(n/QUANTISE)*QUANTISE);});
}
// COLOR_0 is linear; the swatches are sRGB.
const toLinear=v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);

const C={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
const TYPES={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
const chunks=[],views=[],accessors=[],meshes=[],nodes=[];let offset=0;
function append(data,target){const b=Buffer.from(data),view={buffer:0,byteOffset:offset,byteLength:b.length};
  if(target)view.target=target;views.push(view);chunks.push(b);offset+=b.length;
  const pad=(4-offset%4)%4;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}return views.length-1;}

const report=[];
for(const kit of KITS){
 ({data:atlas,info}=await sharp(kit.dir+'Textures/colormap.png').raw().toBuffer({resolveWithObject:true}));
 for(const file of readdirSync(kit.dir).filter(f=>f.endsWith('.glb')&&kit.keep(f)).sort()){
  const buf=readFileSync(kit.dir+file);
  const jl=buf.readUInt32LE(12),j=JSON.parse(buf.toString('utf8',20,20+jl)),bin=buf.subarray(28+jl);
  const read=ai=>{const a=j.accessors[ai],v=j.bufferViews[a.bufferView],T=TYPES[a.componentType];
    const s=(v.byteOffset||0)+(a.byteOffset||0),n=a.count*C[a.type]*T.BYTES_PER_ELEMENT;
    return new T(Uint8Array.from(bin.subarray(s,s+n)).buffer);};
  const position=[],normal=[],colour=[],index=[],seen=new Map();
  for(const node of j.nodes||[]){
    if(node.mesh===undefined)continue;
    const t=node.translation||[0,0,0];
    for(const prim of j.meshes[node.mesh].primitives){
      const pos=read(prim.attributes.POSITION),nrm=read(prim.attributes.NORMAL);
      const uv=read(prim.attributes.TEXCOORD_0),idx=read(prim.indices);
      for(let k=0;k<idx.length;k+=3){
        const c=neutralise(swatch(uv[idx[k]*2],uv[idx[k]*2+1]));
        for(const v of [idx[k],idx[k+1],idx[k+2]]){
          // Vertices are split per triangle-colour: a shared vertex between two
          // differently coloured faces needs one copy per colour.
          const key=v+'@'+t.join(',')+'@'+c.join(',');
          if(!seen.has(key)){seen.set(key,position.length/3);
            position.push(pos[v*3]+t[0],pos[v*3+1]+t[1],pos[v*3+2]+t[2]);
            normal.push(nrm[v*3],nrm[v*3+1],nrm[v*3+2]);
            colour.push(...c.map(x=>Math.round(toLinear(x/255)*255)));}
          index.push(seen.get(key));}
      }
    }
  }
  // Re-seat: base on y=0, centred in x/z, so placement is a plain scale.
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<position.length;i++){const c=i%3;min[c]=Math.min(min[c],position[i]);max[c]=Math.max(max[c],position[i]);}
  const shift=[-(min[0]+max[0])/2,-min[1],-(min[2]+max[2])/2];
  for(let i=0;i<position.length;i++)position[i]+=shift[i%3];

  const p=Float32Array.from(position),col=Uint8Array.from(colour);
  // Normals are stored as signed bytes (KHR_mesh_quantization). These models are
  // flat-shaded off axis-aligned faces, so 1/127 precision is far more than
  // enough, and it takes a third off the packed size.
  const n=Int8Array.from(normal,v=>Math.max(-127,Math.min(127,Math.round(v*127))));
  const small=p.length/3<=65535,ix=small?Uint16Array.from(index):Uint32Array.from(index);
  const lo=min.map((v,i)=>v+shift[i]),hi=max.map((v,i)=>v+shift[i]);
  const base=accessors.length;
  accessors.push({bufferView:append(Buffer.from(p.buffer),34962),componentType:5126,count:p.length/3,type:'VEC3',min:lo,max:hi},
    {bufferView:append(Buffer.from(n.buffer,n.byteOffset,n.byteLength),34962),componentType:5120,normalized:true,count:n.length/3,type:'VEC3'},
    {bufferView:append(Buffer.from(col.buffer),34962),componentType:5121,normalized:true,count:col.length/3,type:'VEC3'},
    {bufferView:append(Buffer.from(ix.buffer,ix.byteOffset,ix.byteLength),34963),componentType:small?5123:5125,count:ix.length,type:'SCALAR'});
  const name=kit.prefix+file.replace(/.glb$/,'');
  nodes.push({mesh:meshes.length,name});
  meshes.push({name,primitives:[{attributes:{POSITION:base,NORMAL:base+1,COLOR_0:base+2},indices:base+3,material:0}]});
  report.push({model:name,triangles:ix.length/3,vertices:p.length/3,size:hi.map((v,i)=>+(v-lo[i]).toFixed(3))});
 }
}

const out={asset:{version:'2.0',generator:'neon-rail building packer'},scene:0,extensionsUsed:['KHR_mesh_quantization'],extensionsRequired:['KHR_mesh_quantization'],
  scenes:[{nodes:nodes.map((n,i)=>i)}],nodes,meshes,
  materials:[{name:'city',pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:.82}}],
  accessors,bufferViews:views,buffers:[{byteLength:offset}]};
let json=Buffer.from(JSON.stringify(out));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const binary=Buffer.concat(chunks),header=Buffer.alloc(20),bh=Buffer.alloc(8);
header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);
header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
bh.writeUInt32LE(binary.length,0);bh.writeUInt32LE(0x004e4942,4);
const glb=Buffer.concat([header,json,bh,binary]);
writeFileSync('outputs/neon-rail/assets/meridian-city-buildings.glb',glb);
console.log(JSON.stringify({models:report.length,totalTriangles:report.reduce((a,r)=>a+r.triangles,0),
  totalKB:+(glb.length/1024).toFixed(1),detail:report},null,1));
