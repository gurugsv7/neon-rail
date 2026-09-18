import * as T from 'three';
export const CAPTURE_DURATION=5.8;
const smooth=t=>{t=T.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};
export function createCapture(scene){
 const root=new T.Group();scene.add(root);root.visible=false;
 const metal=new T.MeshStandardMaterial({color:0x657b80,metalness:.8,roughness:.3}),dark=new T.MeshStandardMaterial({color:0x203b40,metalness:.5,roughness:.45}),pad=new T.MeshStandardMaterial({color:0x232725,roughness:.95}),light=new T.MeshBasicMaterial({color:0xffc368});
 const carriage=new T.Group();root.add(carriage);
 const box=(g,w,h,d,x,y,z,m)=>{const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);g.add(mesh);return mesh;};
 box(carriage,.8,.16,.22,0,.15,.30,dark);box(carriage,.21,.32,.22,0,.40,.3,metal);
 const jaws=[];for(const side of [-1,1]){const jaw=new T.Group();jaw.position.set(side*.42,.1,.3);carriage.add(jaw);box(jaw,.10,.18,.62,0,0,-.22,metal);box(jaw,.22,.15,.16,-side*.07,0,-.55,dark);box(jaw,.09,.15,.35,-side*.055,0,-.25,pad);jaws.push(jaw);}
 const latch=box(carriage,.22,.06,.07,0,.25,.17,light);
 const cable=new T.Mesh(new T.CylinderGeometry(.026,.026,1,8),metal);root.add(cable);
 const scan=new T.Mesh(new T.ConeGeometry(.9,2.7,24,1,true),new T.MeshBasicMaterial({color:0xb1e8db,transparent:true,opacity:.07,depthWrite:false,side:T.DoubleSide}));root.add(scan);
 const wash=new T.Mesh(new T.RingGeometry(.7,.77,48),new T.MeshBasicMaterial({color:0xd7c5a0,transparent:true,opacity:.2,depthWrite:false,side:T.DoubleSide}));wash.rotation.x=-Math.PI/2;root.add(wash);
 const a=new T.Vector3(),b=new T.Vector3(),up=new T.Vector3(0,1,0),offset=new T.Vector3();
 function reset(){root.visible=false;}
 function update(game,t){
  root.visible=true;const x=game.player.x,y=game.captureBase,z=game.captureZ||0;
  const approach=smooth(t/1.25),lower=smooth((t-1.2)/1),clamp=smooth((t-2.15)/.45),lift=smooth((t-2.8)/1.25),away=smooth((t-4)/1.8);
  const drift=Math.sin((t-2.8)*5)*.075*lift*(1-away),rx=x+away*.7,rz=z+away*8;
  const runner=game.character.root;runner.visible=true;runner.position.set(rx+drift,y+lift*1.25,rz);runner.rotation.set(-.05*lift,-.35*clamp,-drift*.7);
  const drone=game.drone;drone.visible=true;drone.position.set(rx+1.6*(1-approach),y+3.8+lift*.8+Math.sin(t*8)*.016,rz+3.5*(1-approach)+.30);
  drone.rotation.set(-.10*(1-approach)-.13*away,0,-.24*Math.sin(approach*Math.PI)+drift*.3);drone.userData.animate?.(t,lift);
  const attachY=y+1.55+lift*1.25,winchY=drone.position.y-.44;
  carriage.position.set(runner.position.x,winchY-.48+(attachY-(winchY-.48))*lower,rz);carriage.rotation.z=-drift*.4;carriage.rotation.y=runner.rotation.y;
  jaws.forEach((jaw,i)=>jaw.rotation.y=(i===0?1:-1)*(.85*(1-clamp)));latch.material.color.setHex(clamp>.95?0xa5f2ac:0xffc368);
  a.copy(drone.position).add(offset.set(0,-.42,0));b.copy(carriage.position).add(offset.set(0,.48,.3));cable.position.copy(a).add(b).multiplyScalar(.5);cable.scale.y=a.distanceTo(b);cable.quaternion.setFromUnitVectors(up,b.sub(a).normalize());
  scan.visible=t>.35&&t<2.6;scan.position.set(drone.position.x,drone.position.y-1.6,drone.position.z-.25);scan.material.opacity=.08*Math.sin(Math.min(1,t/2.6)*Math.PI);
  wash.position.set(rx,y+.035,rz);wash.scale.setScalar(1+(t*1.8%1)*1.6);wash.material.opacity=.15*(1-(t*1.8%1))*(1-away);
  const orbit=smooth((t-.35)/1.5);game.camera.position.set(x+3.5*orbit,y+3.1+lift*.7,z+8+away*7);game.camera.lookAt(rx,y+1.7+lift,rz+.3);game.camera.fov=50+away*5;game.camera.updateProjectionMatrix();
  game.shadow.position.set(rx,y+.035,rz);game.shadow.scale.setScalar(1-lift*.25);game.shadow.material.opacity=.65-lift*.3;
 }
 return {update,reset};
}
