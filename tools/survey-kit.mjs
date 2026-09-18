// Dumps geometry + palette facts for every model in a Kenney kit so the asset
// choices can be made from numbers rather than guesswork. Kenney kits texture
// everything from one flat-swatch colormap, so each triangle's colour is the
// single pixel its UV lands on.
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import sharp from 'sharp';
const DIR=process.argv[2],OUT=process.argv[3];
const {data:atlas,info}=await sharp(DIR+'Textures/colormap.png').raw().toBuffer({resolveWithObject:true});
// glTF puts UV (0,0) at the image's TOP-left, so v maps straight to the row.
function swatch(u,v){
  const x=Math.min(info.width-1,Math.max(0,Math.round(u*info.width-.5)));
  const y=Math.min(info.height-1,Math.max(0,Math.round(v*info.height-.5)));
  const i=(y*info.width+x)*info.channels;
  return '#'+[atlas[i],atlas[i+1],atlas[i+2]].map(c=>c.toString(16).padStart(2,'0')).join('');
}
const C={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
// Accessors carry their own component type: indices are Uint16 in most of the
// kit but not all of it, and reading them as the wrong width silently yields
// garbage vertex ids rather than an error.
const TYPES={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
const models=[];
for(const file of readdirSync(DIR).filter(f=>f.endsWith('.glb')).sort()){
  const buf=readFileSync(DIR+file);
  const jl=buf.readUInt32LE(12),j=JSON.parse(buf.toString('utf8',20,20+jl)),bin=buf.subarray(28+jl);
  const read=ai=>{const a=j.accessors[ai],v=j.bufferViews[a.bufferView],T=TYPES[a.componentType];
    const s=(v.byteOffset||0)+(a.byteOffset||0),n=a.count*C[a.type]*T.BYTES_PER_ELEMENT;
    return new T(Uint8Array.from(bin.subarray(s,s+n)).buffer);};
  const entry={file,bytes:buf.length,meshes:[],parts:{},triangles:0,vertices:0,
    min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
  for(const node of j.nodes||[]){
    if(node.mesh===undefined)continue;
    const t=node.translation||[0,0,0];
    for(const prim of j.meshes[node.mesh].primitives){
      const pos=read(prim.attributes.POSITION),idx=read(prim.indices);
      const uv=prim.attributes.TEXCOORD_0!==undefined?read(prim.attributes.TEXCOORD_0):null;
      entry.triangles+=idx.length/3;entry.vertices+=j.accessors[prim.attributes.POSITION].count;
      for(let i=0;i<pos.length;i+=3)for(let c=0;c<3;c++){
        const val=pos[i+c]+t[c];entry.min[c]=Math.min(entry.min[c],val);entry.max[c]=Math.max(entry.max[c],val);}
      if(!uv)continue;
      for(let k=0;k<idx.length;k+=3){
        const a=idx[k],hex=swatch(uv[a*2],uv[a*2+1]);
        const p=entry.parts[hex]||(entry.parts[hex]={triangles:0,min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]});
        p.triangles++;
        for(const v of [idx[k],idx[k+1],idx[k+2]])for(let c=0;c<3;c++){
          const val=pos[v*3+c]+t[c];p.min[c]=Math.min(p.min[c],val);p.max[c]=Math.max(p.max[c],val);}
      }
    }
    entry.meshes.push(j.meshes[node.mesh].name||node.name);
  }
  entry.size=entry.max.map((v,i)=>+(v-entry.min[i]).toFixed(3));
  entry.min=entry.min.map(v=>+v.toFixed(3));entry.max=entry.max.map(v=>+v.toFixed(3));
  for(const p of Object.values(entry.parts)){p.size=p.max.map((v,i)=>+(v-p.min[i]).toFixed(3));
    p.min=p.min.map(v=>+v.toFixed(3));p.max=p.max.map(v=>+v.toFixed(3));}
  models.push(entry);
}
writeFileSync(OUT,JSON.stringify({atlas:info.width+'x'+info.height,count:models.length,models},null,1));
console.log('surveyed',models.length,'models ->',OUT);
console.log(models.map(m=>`${m.file.padEnd(42)} tris ${String(m.triangles).padStart(5)}  size ${m.size.join(' x ')}  swatches ${Object.keys(m.parts).length}`).join('\n'));
