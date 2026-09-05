// Kenney's track tiles reference an external colormap.png, so the GLBs render
// untextured on their own. That atlas is nothing but flat palette swatches --
// every triangle samples a single pixel -- so instead of shipping a texture we
// split each tile by the swatch it samples and hand the parts to the game to
// colour from its own palette. No texture, no extra draw calls: the pieces
// merge into the chunk's existing static batch like every other box.
import {readFileSync,writeFileSync} from 'node:fs';
import sharp from 'sharp';

const SOURCE='C:/Users/gurug/Downloads/kenney_train-kit/Models/GLB format/';
const VARIANTS=['railroad-straight','railroad-damaged-straight'];
// Kenney's swatch colours, and what each one is on a track tile.
const PARTS={'#bdc5ed':'railTop','#7c8199':'railBody','#ec9368':'sleeperTop','#b46444':'sleeperSide','#abb3d6':'railDamage'};
// Preview colours baked into the asset; the game overrides these from art.js.
const PREVIEW={railTop:[.68,.73,.71],railBody:[.33,.41,.42],sleeperTop:[.54,.44,.35],sleeperSide:[.43,.34,.28],railDamage:[.50,.55,.53]};

const {data:atlas,info}=await sharp(SOURCE+'Textures/colormap.png').raw().toBuffer({resolveWithObject:true});
// glTF puts UV (0,0) at the image's TOP-left, so v maps straight to the row.
function swatch(u,v){
  const x=Math.min(info.width-1,Math.max(0,Math.round(u*info.width-.5)));
  const y=Math.min(info.height-1,Math.max(0,Math.round(v*info.height-.5)));
  const i=(y*info.width+x)*info.channels;
  return '#'+[atlas[i],atlas[i+1],atlas[i+2]].map(c=>c.toString(16).padStart(2,'0')).join('');
}

const COMPONENTS={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
const chunks=[],views=[],accessors=[],meshes=[],materials=[],matIndex=new Map();
let offset=0;
function append(data,target){const b=Buffer.from(data),view={buffer:0,byteOffset:offset,byteLength:b.length};
  if(target)view.target=target;views.push(view);chunks.push(b);offset+=b.length;
  const pad=(4-offset%4)%4;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}return views.length-1;}
function material(part){
  if(!matIndex.has(part)){matIndex.set(part,materials.length);
    materials.push({name:part,pbrMetallicRoughness:{baseColorFactor:[...PREVIEW[part],1],metallicFactor:0,roughnessFactor:.7}});}
  return matIndex.get(part);}

const report=[];
for(const name of VARIANTS){
  const buf=readFileSync(SOURCE+name+'.glb');
  const jsonLength=buf.readUInt32LE(12),j=JSON.parse(buf.toString('utf8',20,20+jsonLength)),bin=buf.subarray(28+jsonLength);
  const read=(ai,T)=>{const a=j.accessors[ai],v=j.bufferViews[ai===undefined?0:a.bufferView];
    const start=(v.byteOffset||0)+(a.byteOffset||0),bytes=a.count*COMPONENTS[a.type]*(T===Uint16Array?2:4);
    return new T(Uint8Array.from(bin.subarray(start,start+bytes)).buffer);};
  const prim=j.meshes[0].primitives[0];
  const pos=read(prim.attributes.POSITION,Float32Array),nrm=read(prim.attributes.NORMAL,Float32Array);
  const uv=read(prim.attributes.TEXCOORD_0,Float32Array),idx=read(prim.indices,Uint16Array);

  // Re-seat: base on y=0 and centred in z, so a tile is placed by its middle
  // and butts against its neighbours with no compensating offsets.
  let minY=Infinity,minZ=Infinity,maxZ=-Infinity;
  for(let i=0;i<pos.length;i+=3){minY=Math.min(minY,pos[i+1]);minZ=Math.min(minZ,pos[i+2]);maxZ=Math.max(maxZ,pos[i+2]);}
  const shiftZ=-(minZ+maxZ)/2;
  for(let i=0;i<pos.length;i+=3){pos[i+1]-=minY;pos[i+2]+=shiftZ;}

  const groups=new Map();
  for(let t=0;t<idx.length;t+=3){
    const a=idx[t],hex=swatch(uv[a*2],uv[a*2+1]),part=PARTS[hex];
    if(!part)throw new Error(`${name}: unmapped swatch ${hex} at uv ${uv[a*2]},${uv[a*2+1]}`);
    if(!groups.has(part))groups.set(part,[]);
    groups.get(part).push(idx[t],idx[t+1],idx[t+2]);
  }
  const primitives=[],parts={};
  for(const [part,tris] of groups){
    // Re-index each part onto only the vertices it actually uses.
    const remap=new Map(),position=[],normal=[],texcoord=[],indices=[];
    for(const v of tris){
      if(!remap.has(v)){remap.set(v,remap.size);
        position.push(pos[v*3],pos[v*3+1],pos[v*3+2]);
        normal.push(nrm[v*3],nrm[v*3+1],nrm[v*3+2]);
        // UVs are unused by the flat palette materials, but BufferGeometryUtils
        // only merges geometries whose attribute sets match, and the scenery
        // boxes this batches with all carry one.
        texcoord.push(0,0);}
      indices.push(remap.get(v));}
    const p=Float32Array.from(position),n=Float32Array.from(normal),t2=Float32Array.from(texcoord),ix=Uint16Array.from(indices);
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<p.length;i++){const c=i%3;min[c]=Math.min(min[c],p[i]);max[c]=Math.max(max[c],p[i]);}
    const base=accessors.length;
    accessors.push({bufferView:append(Buffer.from(p.buffer),34962),componentType:5126,count:p.length/3,type:'VEC3',min,max},
      {bufferView:append(Buffer.from(n.buffer),34962),componentType:5126,count:n.length/3,type:'VEC3'},
      {bufferView:append(Buffer.from(t2.buffer),34962),componentType:5126,count:t2.length/2,type:'VEC2'},
      {bufferView:append(Buffer.from(ix.buffer),34963),componentType:5123,count:ix.length,type:'SCALAR'});
    primitives.push({attributes:{POSITION:base,NORMAL:base+1,TEXCOORD_0:base+2},indices:base+3,material:material(part)});
    parts[part]=ix.length/3;
  }
  // Primitive order is the part order; names carry it across to the loader.
  meshes.push({name,primitives,extras:{parts:[...groups.keys()]}});
  report.push({variant:name,triangles:idx.length/3,parts});
}

const out={asset:{version:'2.0',generator:'neon-rail track optimizer'},scene:0,
  scenes:[{nodes:meshes.map((m,i)=>i)}],nodes:meshes.map((m,i)=>({mesh:i,name:m.name})),
  meshes,materials,accessors,bufferViews:views,buffers:[{byteLength:offset}]};
let json=Buffer.from(JSON.stringify(out));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const binary=Buffer.concat(chunks),header=Buffer.alloc(20),bh=Buffer.alloc(8);
header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);
header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
bh.writeUInt32LE(binary.length,0);bh.writeUInt32LE(0x004e4942,4);
const glb=Buffer.concat([header,json,bh,binary]);
writeFileSync('outputs/neon-rail/assets/meridian-rails.glb',glb);
console.log(JSON.stringify({report,totalKB:+(glb.length/1024).toFixed(1)},null,1));
