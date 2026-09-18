// Original rail architecture. Everything is static and joins the chunk's
// material batches; piers stay outside the three playable lanes.
export function addRailArchitecture(g,index,k){
  const {T,box,cyl,sphere,mat,signTexture}=k,zone=Math.floor(index/3)%4;
  const stone=0xd9c5a3,ink=0x254c51,iron=0x456969,copper=0xb6754c;
  const glow=mat(0xffe6b2,{emissive:0xffd693,emissiveIntensity:.45});
  const labels=addRailArchitecture.labels??=new Map();
  function label(text,bg='#244d50',fg='#edddba'){
    const key=text+bg+fg;if(!labels.has(key))labels.set(key,signTexture(text,bg,fg));return labels.get(key);
  }
  function beam(a,b,w,d,color){
    const av=new T.Vector3(...a),bv=new T.Vector3(...b),m=box(g,w,av.distanceTo(bv),d,...av.clone().add(bv).multiplyScalar(.5).toArray(),color);
    m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),bv.sub(av).normalize());return m;
  }
  function arch(r,thick,spring,z,depth,color,start=0,end=Math.PI){
    const s=new T.Shape();s.absarc(0,spring,r+thick,start,end,false);
    s.lineTo(r*Math.cos(end),spring+r*Math.sin(end));s.absarc(0,spring,r,end,start,true);s.closePath();
    const geo=new T.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:20});
    const m=new T.Mesh(geo,typeof color==='object'?color:mat(color));m.position.z=z-depth/2;g.add(m);return m;
  }
  function rib(z,color=stone,segmented=false){
    if(segmented){for(let i=0;i<18;i++)arch(7.7,.48,5.6,z,.52,i%3===0?0xe5d5b7:color,i*Math.PI/18+.006,(i+1)*Math.PI/18-.006);}
    else arch(7.7,.24,5.6,z,.34,color);
    for(const side of [-1,1]){box(g,.52,5.6,.64,side*7.97,2.8,z,color);box(g,.82,.3,.9,side*7.97,.15,z,stone);box(g,.7,.28,.8,side*7.97,5.48,z,stone);}
  }
  function tunnelLights(){for(const side of [-1,1])for(const z of [-17,-1,15]){
    box(g,.13,.9,.28,side*7.53,4.55,z,iron,true);box(g,.15,.62,.19,side*7.43,4.55,z,glow,true);
    box(g,.035,.12,6.4,side*7.58,1.2,z,0xe7c486);
  }}
  if(zone===3){
    const style=index%3;
    for(const side of [-1,1]){
      box(g,.38,5.65,48,side*7.99,2.7,0,style===0?0x9d6854:style===1?ink:0x769287);
      box(g,.48,.6,48,side*7.93,.25,0,stone);
      box(g,.08,.24,48,side*7.76,5.28,0,style===0?stone:copper);
    }
    if(style===0){
      // Reclaimed masonry barrel vault, limestone voussoirs and a daylight slit.
      for(const z of [-18,-6,6,18]){
        arch(7.94,.26,5.6,z,11.5,0xb07e61,.01,1.38);
        arch(7.94,.26,5.6,z,11.5,0xb07e61,1.76,Math.PI-.01);
      }
      for(const z of [-23.5,-12,0,12,23.5])rib(z,stone,true);
      for(const side of [-1,1]){
        for(let y=.9;y<5.2;y+=.48)box(g,.018,.027,47.5,side*7.791,y,0,0xc89575);
        for(let row=0;row<8;row++)for(let z=-22+(row%2)*.9;z<24;z+=2.4)box(g,.02,.42,.025,side*7.78,1.15+row*.48,z,0xc89575);
        for(const z of [-16,8]){
          box(g,.10,2.7,1.8,side*7.73,1.85,z,0x374f4c,true);
          box(g,.12,.06,1.45,side*7.66,2.9,z,copper);
          for(let zz=-.55;zz<.7;zz+=.3)box(g,.14,1.2,.035,side*7.66,2,z+zz,stone);
        }
      }
      box(g,3.7,.56,.16,0,12.4,22.9,label('09 / SUNVAULT'));
    }else if(style===1){
      // Riveted steel portal frames; exposed copper service mains flank the line.
      for(const z of [-23,-12,0,12,23]){
        const points=[[-7.75,.5,z],[-7.75,6,z],[-5.7,12.6,z],[5.7,12.6,z],[7.75,6,z],[7.75,.5,z]];
        for(let i=0;i<points.length-1;i++)beam(points[i],points[i+1],.28,.5,copper);
        for(const side of [-1,1])for(const y of [2.4,5.8,8.2]){
          box(g,.44,.54,.09,side*(y>6?7:7.72),y,z+.31,iron,true);
          for(const x of [-.12,.12])sphere(g,.047,side*(y>6?7:7.72)+x,y,z+.38,stone);
        }
      }
      for(const side of [-1,1]){
        for(const y of [5.8,6.55]){
          const pipe=cyl(g,.16,.16,48,side*7.25,y,0,copper,12);pipe.rotation.x=Math.PI/2;
          for(const z of [-19,-7,5,17]){const flange=cyl(g,.26,.26,.15,side*7.25,y,z,iron,12);flange.rotation.x=Math.PI/2;}
        }
        for(const z of [-18,-6,6,18]){
          beam([side*7.7,6,z],[side*5.55,12.8,z],1.65,10.8,0x769193);
          box(g,.04,3.6,7.5,side*7.77,2.9,z,0x3c686c);
          box(g,.035,.72,3.3,side*7.72,3.1,z,label('MTR / PUMP 06'));
        }
      }
      box(g,4.1,.66,.15,0,11.8,22.6,label('10 / SWITCHWORKS','#b6754c','#203f43'));
    }else{
      // The old cutting has become a light garden: split glazed roof and vines.
      for(const z of [-23.5,-16,-8,0,8,16,23.5])rib(z,0xcab187);
      for(const z of [-18,-6,6,18]){
        arch(7.95,.09,5.6,z,9.8,mat(0xbdd7c8,{metalness:.18,roughness:.32}),.15,1.13);
        arch(7.95,.09,5.6,z,9.8,mat(0xbdd7c8,{metalness:.18,roughness:.32}),2.01,2.99);
      }
      for(const side of [-1,1])for(const z of [-18,-6,6,18]){
        box(g,.65,.46,4.2,side*7.35,5.6,z,stone,true);
        box(g,.56,.07,3.95,side*7.33,5.86,z,0x566843);
        for(let j=0;j<7;j++){
          const zz=z-1.7+j*.52,y=5.5-(j%3)*.5;
          beam([side*7.2,5.8,zz],[side*7.1,y-.5,zz+.15],.035,.035,0x4e754f);
          sphere(g,.23,side*7.05,y,zz,0x739962,1,.65,1.7);
          sphere(g,.19,side*7.04,y-.45,zz+.15,0xa5b773,1,.6,1.5);
        }
      }
      box(g,3.9,.56,.15,0,12.4,22.8,label('11 / SOLARIUM CUT'));
    }
    tunnelLights();
  }
  if(zone===1){
    // Folded wing canopies, Y brackets and timber slat benches.
    for(const side of [-1,1]){
      box(g,2.45,.68,45,side*6.48,.2,0,stone);
      for(const z of [-19,-7,5,17]){
        beam([side*7.12,.5,z],[side*7.12,4.65,z],.22,.26,iron);
        beam([side*7.12,3.4,z],[side*5.35,4.9,z],.12,.15,copper);
        beam([side*7.12,3.7,z],[side*7.85,4.9,z],.12,.15,copper);
        const inner=box(g,1.55,.15,11.6,side*5.89,5.12,z,0x287573);inner.rotation.z=side*.25;
        const outer=box(g,1.2,.15,11.6,side*7.23,5.09,z,0x287573);outer.rotation.z=-side*.3;
        box(g,.07,.065,10.8,side*5.2,4.88,z,glow);
        for(let j=0;j<5;j++)box(g,.17,.095,2.6,side*(5.9+j*.2),1.03,z,0xa77f55,true);
        for(const zz of [-.9,.9])box(g,.8,.55,.12,side*6.3,.74,z+zz,iron);
        box(g,.12,.62,2.65,side*6.8,1.38,z,0xa77f55,true);
      }
      box(g,2.1,.58,.1,side*6.35,4.12,9,label('E7 / EAST LINE'));
      for(let z=-22;z<23;z+=2.4)box(g,.16,.045,1.2,side*5.27,.56,z,0xe8b957);
    }
  }
  if(index%4===2){
    // Bowstring footbridge: tension hangers and a curved truss silhouette.
    box(g,18,.4,4.5,0,14.85,0,stone);
    for(const side of [-1,1]){
      box(g,.7,14.7,3.8,side*8.6,7.3,0,iron);
      beam([side*8.6,12,0],[side*6.8,14.6,0],.35,3.5,copper);
    }
    for(const z of [-2.35,2.35]){
      const a=arch(8.5,.23,0,z,.24,0x377b7a);a.scale.y=.42;a.position.y=15.2;
      box(g,17,.14,.18,0,15.25,z,iron);
      for(let x=-7.5;x<=7.5;x+=1.5){const y=15.2+Math.sqrt(8.5**2-x*x)*.42;beam([x,15.3,z],[x,y,z],.055,.055,copper);}
      for(let x=-8;x<8;x+=2)beam([x,15.25,z],[x+2,16.05,z],.05,.05,iron);
      box(g,17,.09,.09,0,16.05,z,iron);
    }
    box(g,4,.65,.15,0,14.3,2.28,label('MERIDIAN / '+String(index+1).padStart(2,'0')));
  }
}
