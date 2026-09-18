import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
export function securityDrone(){
 const root=new T.Group(),shell=new T.Group();root.add(shell);
 const dark=new T.MeshStandardMaterial({color:0x3d565e,metalness:.4,roughness:.48}),ivory=new T.MeshStandardMaterial({color:0xd7d7bd,metalness:.4,roughness:.46}),rubber=new T.MeshStandardMaterial({color:0x111d22,roughness:.85}),metal=new T.MeshStandardMaterial({color:0x83989a,metalness:.8,roughness:.25}),amber=new T.MeshStandardMaterial({color:0xffb74f,emissive:0xff9e22,emissiveIntensity:1.1}),red=new T.MeshBasicMaterial({color:0xff6344}),green=new T.MeshBasicMaterial({color:0x8cffe0});
 const cube=new RoundedBoxGeometry(1,1,1,2,.10);
 const block=(g,w,h,d,x,y,z,m)=>{const o=new T.Mesh(cube,m);o.scale.set(w,h,d);o.position.set(x,y,z);g.add(o);return o;};
 block(shell,1.18,.34,1.42,0,0,0,dark);block(shell,1.05,.16,1.2,0,.23,0,ivory);block(shell,.67,.09,.9,0,.34,.05,dark);
 for(const x of [-.43,.43]){block(shell,.055,.055,1.03,x,.33,0,metal);for(let z=-.4;z<.5;z+=.14)block(shell,.19,.025,.045,x,.345,z,rubber);}
 for(const side of [-1,1]){block(shell,.055,.18,.72,side*.6,.02,.05,ivory);for(let z=-.25;z<.3;z+=.13)block(shell,.065,.045,.06,side*.637,.015,z,rubber);block(shell,.055,.055,.37,side*.64,.15,.02,amber);}
 // Exposed underside service panels remain readable from the runner's camera.
 block(shell,.9,.045,.93,0,-.19,.02,ivory);block(shell,.48,.055,.45,0,-.23,.09,dark);
 for(const x of [-.35,.35]){block(shell,.065,.06,.66,x,-.24,.03,metal);block(shell,.11,.035,.16,x,-.28,.10,amber);}
 for(const x of [-.33,0,.33])block(shell,.17,.065,.055,x,.05,.735,ivory);
 const rotors=[];
 for(const x of [-.91,.91])for(const z of [-.69,.69]){
  const arm=block(shell,.67,.10,.17,x*.6,-.015,z*.75,dark);arm.rotation.y=-Math.sign(x*z)*.3;
  const duct=new T.Mesh(new T.CylinderGeometry(.42,.39,.22,24,1,true),ivory);duct.position.set(x,.035,z);shell.add(duct);
  for(const y of [-.08,.15]){const lip=new T.Mesh(new T.TorusGeometry(.405,.034,6,24),dark);lip.rotation.x=Math.PI/2;lip.position.set(x,y,z);shell.add(lip);}
  block(shell,.8,.026,.035,x,.18,z,metal);block(shell,.035,.026,.8,x,.18,z,metal);
  const hub=new T.Mesh(new T.CylinderGeometry(.095,.08,.17,12),dark);hub.position.set(x,.08,z);shell.add(hub);
  const geo=[];for(let i=0;i<3;i++){const blade=new T.BoxGeometry(.32,.015,.072);blade.translate(.19,0,0);blade.rotateY(i*Math.PI*2/3);geo.push(blade);}const rotor=new T.Mesh(mergeGeometries(geo),rubber);geo.forEach(g=>g.dispose());rotor.position.set(x,.035,z);rotors.push(rotor);root.add(rotor);
  block(shell,.08,.05,.08,x,.18,z+Math.sign(z)*.36,z<0?red:green);
  block(shell,.055,.22,.07,x,-.20,z,metal);block(shell,.24,.05,.12,x,-.32,z,rubber);
 }
 const camera=new T.Group();camera.position.set(0,-.25,-.62);root.add(camera);
 block(camera,.43,.28,.30,0,0,0,dark);const lens=new T.Mesh(new T.CylinderGeometry(.095,.095,.055,16),metal);lens.rotation.x=Math.PI/2;lens.position.z=-.17;camera.add(lens);
 const eye=new T.Mesh(new T.CircleGeometry(.067,16),new T.MeshBasicMaterial({color:0x89f4f5}));eye.position.z=-.201;eye.rotation.y=Math.PI;camera.add(eye);
 block(shell,.5,.13,.45,0,-.27,.1,dark);for(const x of [-.18,.18])block(shell,.055,.15,.3,x,-.37,.1,metal);
 // Merge stationary hardware by material; only four rotors and sensor pivot animate.
 shell.updateMatrixWorld(true);const buckets=new Map();shell.traverse(o=>{if(!o.isMesh)return;const a=buckets.get(o.material)||[];a.push((o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrixWorld));buckets.set(o.material,a);});shell.clear();for(const [m,geos] of buckets){const o=new T.Mesh(mergeGeometries(geos),m);o.castShadow=true;shell.add(o);geos.forEach(g=>g.dispose());}
 root.userData.animate=(time,load=0)=>{rotors.forEach((r,i)=>r.rotation.y=time*(i%2?1:-1)*(45+load*22));camera.rotation.x=-.55-load*.35+Math.sin(time*.6)*.05;camera.rotation.y=Math.sin(time*.7)*.18;};
 return root;
}
