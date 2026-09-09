import {T,indexBuildings,box,cyl,sphere,mat,courier,animateCourier,drone,tokenModel,powerModel,POWER_COLORS,obstacleModel,rampModel,sceneryChunk,shadowTexture} from './art.js';
import {LANE,MAX_SPEED,TRAIN_ROOF,TRAIN_CLEARANCE,TRAIN_HALF,RAMP_LENGTH,PlayerController,SaveManager,MISSIONS,POWER_NAMES,planPattern,rng} from './core.js';
import {AudioManager} from './audio.js';
import {prepareTrainAsset} from './train-asset.js';
import {prepareCharacterAsset,characterModel} from './character-asset.js';
import {createMotionControl} from './motion-control.js';
import {prepareTracker,requestHead} from './motion-tracker.js';
import {createMotionSignal,normaliseHead,previewBox} from './motion-signal.js';

import {prepareCityBuildingAsset} from './city-buildings-asset.js';
import {prepareRailAsset} from './rail-asset.js';
import {prepareCityAsset} from './city-asset.js';
import {prepareTreeAsset} from './tree-asset.js';
const $=id=>document.getElementById(id),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

class ParticleManager{
  constructor(scene){this.capacity=160;this.cursor=0;this.data=Array.from({length:this.capacity},()=>({life:0,x:0,y:0,z:0,vx:0,vy:0,vz:0}));this.mesh=new T.InstancedMesh(new T.BoxGeometry(.07,.07,.07),new T.MeshBasicMaterial({color:0xffffff}),this.capacity);this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.mesh.frustumCulled=false;this.dummy=new T.Object3D();scene.add(this.mesh);this.step(0,0);}
  burst(x,y,z,color,count=12){for(let n=0;n<count;n++){const p=this.data[this.cursor++%this.capacity];Object.assign(p,{life:.4+Math.random()*.4,x,y,z,vx:(Math.random()-.5)*5,vy:Math.random()*4,vz:(Math.random()-.5)*4});this.mesh.setColorAt((this.cursor-1)%this.capacity,new T.Color(color));}if(this.mesh.instanceColor)this.mesh.instanceColor.needsUpdate=true;}
  step(dt,speed){this.data.forEach((p,i)=>{p.life=Math.max(0,p.life-dt);if(p.life>0){p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=(p.vz+speed*.6)*dt;p.vy-=8*dt;this.dummy.position.set(p.x,p.y,p.z);this.dummy.scale.setScalar(Math.min(1,p.life*5));this.dummy.rotation.set(p.life*5,p.life*8,0);}else this.dummy.scale.setScalar(0);this.dummy.updateMatrix();this.mesh.setMatrixAt(i,this.dummy.matrix);});this.mesh.instanceMatrix.needsUpdate=true;}
}

class WorldGenerator{
  constructor(scene){this.scene=scene;this.templates=new Map();this.pool=new Map();this.entities=[];this.tokens=[];this.powers=[];this.chunks=[];this.scratch=new T.Object3D();
    for(const type of ['hurdle','overhead','cargo','train','approach','depart','rampTrain','gap']){let model;if(['approach','depart'].includes(type))model=this.templates.get('train');else model=obstacleModel(type);this.templates.set(type,model);this.pool.set(type,[]);}this.rampTemplate=rampModel();
    for(let i=0;i<12;i++){const group=sceneryChunk(i);scene.add(group);this.chunks.push({group,index:i});}
    const tm=tokenModel();this.tokenMeshes=[];tm.updateMatrixWorld(true);tm.traverse(o=>{if(o.isMesh){const geo=o.geometry.clone().applyMatrix4(o.matrixWorld);const m=new T.InstancedMesh(geo,o.material,500);m.instanceMatrix.setUsage(T.DynamicDrawUsage);m.frustumCulled=false;scene.add(m);this.tokenMeshes.push(m);}});
    this.powerTemplates=Object.fromEntries(['magnet','boost','shield','board'].map(type=>[type,powerModel(type)]));this.powerPool=[];this.reset(2039);
  }
  recycle(e){e.model.visible=false;this.pool.get(e.type).push(e.model);if(e.ramp){this.scene.remove(e.ramp);}}
  reset(seed){for(const e of this.entities)this.recycle(e);for(const p of this.powers)this.scene.remove(p.model);this.entities=[];this.tokens=[];this.powers=[];this.random=rng(seed);this.next=60;this.index=0;this.safe=1;this.generated=0;this.chunks.forEach((c,i)=>{c.index=i-1;});this.generate(0);}
  addEntity(type,lane,s){const pool=this.pool.get(type);const model=pool.length?pool.pop():this.templates.get(type).clone();model.visible=true;model.position.set((lane-1)*LANE,0,-s);if(!model.parent)this.scene.add(model);model.traverse(o=>{if(o.isMesh)o.castShadow=type!=='gap';});const e={type,lane,s,baseS:s,age:0,model,hit:false,passed:false,warned:false,near:false};
    if(type==='rampTrain'){e.ramp=this.rampTemplate.clone();this.scene.add(e.ramp);}
    this.entities.push(e);return e;
  }
  addToken(lane,s,y=1.05){if(this.tokens.length<490)this.tokens.push({x:(lane-1)*LANE,s,y,phase:this.random()*6.28,collected:false});}
  addPower(type,lane,s){const model=this.powerTemplates[type].clone();this.scene.add(model);const p={type,lane,x:(lane-1)*LANE,s,y:1.25,model};this.powers.push(p);return p;}
  generate(distance){while(this.next<distance+310){const pattern=planPattern(this.index,this.safe,this.random),s=this.next;
      for(const h of pattern.hazards){this.addEntity(h.type,h.lane,s);if(['rampTrain','train'].includes(h.type)){for(let z=-5;z<=5;z+=2.5)this.addToken(h.lane,s+z,TRAIN_ROOF+.95);if(h.type==='rampTrain')for(let j=0;j<7;j++)this.addToken(h.lane,s-TRAIN_HALF-RAMP_LENGTH+j*2.1,1+j*2.1/RAMP_LENGTH*TRAIN_ROOF);}
        else if(h.type==='hurdle'||h.type==='cargo'||h.type==='gap'){for(let j=-2;j<=2;j++)this.addToken(h.lane,s+j*2.1,1.2+Math.cos(j*.55)*1.8);}}
      // A visible token ribbon traces the guaranteed bypass lane.
      for(let j=-3;j<=4;j++)this.addToken(pattern.safe,s+j*3.3);
      const old=this.safe;for(let j=0;j<4;j++){const lane=j<2?old:pattern.safe;this.addToken(lane,s-27+j*3.7);}
      if(this.index%2===0)this.addPower(['magnet','shield','boost','board'][Math.floor(this.index/2)%4],pattern.safe,s-13);
      this.safe=pattern.safe;this.next+=pattern.spacing;this.index++;this.generated++;
    }}
  surface(player,distance){let top=0;for(const e of this.entities){
      const dx=Math.abs(player.x-(e.lane-1)*LANE);if(dx>1.42)continue;const d=distance-e.s;
      // The ramp is solid, so anyone near enough to be struck by the train is
      // near enough to be carried by its ramp. The old rule also required the
      // player to already be at slope height, which meant switching into the
      // lane part-way up left them running inside the wedge with no way back
      // onto it and a certain collision with the train body.
      if(e.ramp&&d>=-TRAIN_HALF-RAMP_LENGTH&&d< -TRAIN_HALF+.15)
        top=Math.max(top,clamp((d+TRAIN_HALF+RAMP_LENGTH)/RAMP_LENGTH,0,1)*TRAIN_ROOF);
      if(dx>1.18)continue;
      if(['train','approach','depart','rampTrain'].includes(e.type)&&Math.abs(d)<TRAIN_HALF&&player.y>=TRAIN_ROOF-.17&&player.vy<=.1)top=Math.max(top,TRAIN_ROOF);
      if(e.type==='cargo'&&Math.abs(d)<.9&&player.y>=1.28&&player.vy<=.1)top=Math.max(top,1.42);
    }return top;}
  step(dt,game){const distance=game.distance;this.generate(distance);
    for(const c of this.chunks){if(c.index*48+24<distance-42)c.index+=this.chunks.length;c.group.position.z=distance-c.index*48;}
    for(let i=this.entities.length-1;i>=0;i--){const e=this.entities[i],ahead=e.s-distance;
      // Once dispatched, velocity continues until the train is recycled behind
      // the player. Never clamp displacement: that visibly stopped old trains.
      if(e.type==='approach'&&(e.age>0||e.baseS-distance<50)){e.age+=dt;e.s-=18*dt;}
      if(e.type==='depart'&&(e.age>0||e.baseS-distance<40)){e.age+=dt;e.s+=2.5*dt;}
      e.model.position.set((e.lane-1)*LANE,0,distance-e.s);if(e.ramp)e.ramp.position.set((e.lane-1)*LANE,0,distance-e.s+TRAIN_HALF+RAMP_LENGTH/2);
      if(e.type==='approach'&&!e.warned&&ahead<78){e.warned=true;game.audio.play('horn');if(game.state==='playing')game.toast('INBOUND TRAIN','Watch the headlights',1.2);}
      if(ahead< -28){this.recycle(e);this.entities.splice(i,1);}
    }
    for(let i=this.tokens.length-1;i>=0;i--)if(this.tokens[i].s<distance-9||this.tokens[i].collected)this.tokens.splice(i,1);
    for(let i=this.powers.length-1;i>=0;i--){const p=this.powers[i];p.model.position.set(p.x,p.y+Math.sin(game.time*3)*.12,distance-p.s);p.model.rotation.y=game.time*1.5;if(p.s<distance-8){this.scene.remove(p.model);this.powers.splice(i,1);}}
  }
  renderTokens(game){let n=0;for(const p of this.tokens){if(p.collected)continue;this.scratch.position.set(p.x,p.y+Math.sin(game.time*3+p.phase)*.07,game.distance-p.s);this.scratch.rotation.set(0,game.time*2+p.phase,0);this.scratch.scale.setScalar(1);this.scratch.updateMatrix();for(const m of this.tokenMeshes)m.setMatrixAt(n,this.scratch.matrix);n++;}for(const m of this.tokenMeshes){m.count=n;m.instanceMatrix.needsUpdate=true;}}
}

class CollisionSystem{
  update(game,dt){const p=game.player,dist=game.distance;
    for(const token of game.world.tokens){if(token.collected)continue;const z=token.s-dist,dx=token.x-p.x,dy=token.y-(p.y+(p.slide>0?.55:1.05));if(game.power.magnet>0&&Math.abs(z)<15&&Math.abs(dx)<8){const k=1-Math.exp(-10*dt);token.x-=dx*k;token.y-=dy*k;token.s+=(dist+.1-token.s)*k;}
      if(Math.abs(token.s-dist)<.8&&Math.abs(token.x-p.x)<.8&&Math.abs(token.y-(p.y+(p.slide>0?.55:1.05)))<1.05){token.collected=true;game.collect(token);}}
    for(let i=game.world.powers.length-1;i>=0;i--){const o=game.world.powers[i];if(Math.abs(o.s-dist)<1.0&&Math.abs(o.x-p.x)<.9&&Math.abs(o.y-p.y-1)<1.35){game.activate(o.type);game.scene.remove(o.model);game.world.powers.splice(i,1);}}
    for(const e of game.world.entities){const z=dist-e.s,x=(e.lane-1)*LANE,dx=Math.abs(p.x-x),train=['train','approach','depart','rampTrain'].includes(e.type),half=train?TRAIN_HALF-.2:e.type==='gap'?2.65:e.type==='cargo'?.75:.28;
      if(z>half+.55&&!e.passed){e.passed=true;if(!e.hit){if(train){game.stat('trains',1);if(p.y>TRAIN_ROOF-.3){game.bonus(120,'ROOFTOP EXPRESS');}else if(Math.abs(p.lane-e.lane)===1)game.bonus(35,'TRAIN DODGE');}else if(dx<1.2&&p.y>.6&&e.type!=='overhead'){game.stat('jumps',1);game.bonus(25,'CLEAN AIR');}}}
      if(e.hit||p.invincible>0||Math.abs(z)>half+.20)continue;
      if(dx>1.42){if(!e.near&&dx<2.1&&Math.abs(z)<half+.15){e.near=true;game.bonus(20,'CLOSE CALL');game.audio.play('near');game.glance=.95;}continue;}
      // Collision volumes are narrower than visible meshes. A crouch must clear
      // the overhead sign; downward ground checks permit train-roof landings.
      const hit=train?p.y<TRAIN_CLEARANCE:e.type==='overhead'?(p.y+(p.slide>0?.8:1.98)>1.58&&p.y<3):e.type==='hurdle'?p.y<.93:e.type==='cargo'?p.y<1.28:e.type==='gap'?p.y<.28:false;
      if(hit){e.hit=true;if(e.type==='gap'&&game.power.shield<=0&&game.power.board<=0){p.fall=1;p.grounded=false;p.vy=-3;game.pendingDeath=.42;game.audio.play('hit');game.toast('MISSED THE CROSSING','',.8);}else game.hit(train||e.type==='cargo',e);}
    }
  }
}

class UIManager{
  constructor(game){this.game=game;this.lastUpdate=0;this.powerSignature='';
    const bind=(id,fn)=>$(id).addEventListener('click',()=>{game.audio.start();game.audio.play('ui');fn();document.activeElement?.blur();});
    bind('run',()=>game.start());bind('again',()=>game.start());bind('restart',()=>game.start());bind('resume',()=>game.resume());bind('quit',()=>game.menu());bind('main-menu',()=>game.menu());bind('pause-button',()=>game.pause());bind('audio',()=>{game.audio.enabled=!game.audio.enabled;$('audio').textContent=game.audio.enabled?'♪':'♫̸';$('audio').setAttribute('aria-pressed',String(!game.audio.enabled));});bind('fullscreen',()=>game.fullscreen());this.state('menu');
  }
  state(state){for(const [id,s] of [['menu','menu'],['hud','playing'],['paused','paused'],['gameover','over']])$(id).classList.toggle('hidden',state!==s);$('pause-button').classList.toggle('hidden',state!=='playing');$('menu-best').textContent=String(Math.floor(this.game.save.data.best)).padStart(6,'0');const m=MISSIONS.find(m=>this.game.save.data[m.key]<m.target);$('next-mission').textContent=m?`${m.text} · ${Math.min(m.target,Math.floor(this.game.save.data[m.key]))}/${m.target}`:'All deliveries complete. Chase your best.';}
  update(dt){this.lastUpdate+=dt;if(this.lastUpdate<.07)return;this.lastUpdate=0;const g=this.game;$('score').textContent=String(Math.floor(g.score)).padStart(6,'0');$('distance').textContent=`${Math.floor(g.distance)} m`;$('tokens').lastElementChild.textContent=g.tokens;$('mult').textContent=`×${g.multiplier*(g.power.boost>0?2:1)}`;$('speedbar').style.width=`${(g.speed-12)/18*100}%`;
    const zones=['SUNWASH YARDS','MERIDIAN STATION','GARDEN VIADUCT','SERVICE TUNNELS'],zone=Math.floor(g.distance/144)%4;$('zone').textContent=`0${zone+1} / ${zones[zone]}`;
    $('chase').textContent=g.threat>0?'SECURITY SIGNAL · CLOSING IN':'SECURITY SIGNAL · LOW';$('chase').classList.toggle('danger',g.threat>0);$('help').classList.toggle('hidden',g.distance>140);
    const active=Object.keys(g.power).filter(k=>g.power[k]>0),sig=active.join();if(sig!==this.powerSignature){this.powerSignature=sig;$('powers').innerHTML=active.map(k=>`<div class="power" id="power-${k}"><strong>${POWER_NAMES[k].toUpperCase()}</strong><span></span><i></i></div>`).join('');}for(const k of active){const el=$(`power-${k}`);el.children[1].textContent=k==='shield'?'1 HIT · '+Math.ceil(g.power[k])+'s':Math.ceil(g.power[k])+'s';el.lastElementChild.style.width=`${g.power[k]/g.powerDuration[k]*100}%`;}
  }
  result(){const g=this.game;$('final-score').textContent=Math.floor(g.score).toLocaleString();$('final-distance').textContent=Math.floor(g.distance)+' m';$('final-tokens').textContent=g.tokens;$('final-best').textContent=Math.floor(g.save.data.best).toLocaleString();$('result-label').textContent=g.newBest?'NEW PERSONAL BEST / DELIVERY LOGGED':'SIGNAL LOST / COURIER RECOVERED';$('missions').innerHTML=MISSIONS.map(m=>{const n=Math.min(m.target,Math.floor(g.save.data[m.key]));return `<div class="mission">${m.text}<span>${n>=m.target?'✓ DONE':n+' / '+m.target}</span><div class="missionbar"><i style="width:${n/m.target*100}%"></i></div></div>`;}).join('');}
}

class Game{
  constructor(){this.state='menu';this.time=0;this.distance=0;this.speed=17;this.score=0;this.tokens=0;this.threat=0;this.glance=0;this.seed=0;this.power={magnet:0,boost:0,shield:0,board:0};this.powerDuration={magnet:12,boost:14,shield:25,board:16};this.save=new SaveManager(localStorage);this.audio=new AudioManager();this.player=new PlayerController();this.collision=new CollisionSystem();this.shake=0;this.toastTime=0;this.accum=0;this.pendingDeath=0;this.clock=0;this.chain=0;this.lastToken=0;this.saveTimer=0;this.multiplier=1+MISSIONS.filter(m=>this.save.data[m.key]>=m.target).length;this.completed=new Set(MISSIONS.filter(m=>this.save.data[m.key]>=m.target).map(m=>m.key));
    this.scene=new T.Scene();this.scene.background=new T.Color(0xbcdde0);this.scene.fog=new T.Fog(0xbcdde0,70,245);
    this.renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.6,1920/innerWidth,1080/innerHeight));this.renderer.setSize(innerWidth,innerHeight);this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap;this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.02;document.body.prepend(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-label','NEON RAIL 3D game');
    this.camera=new T.PerspectiveCamera(56,innerWidth/innerHeight,.1,310);this.camera.position.set(-.6,3.6,10);this.look=new T.Vector3(-2,1.8,-9);
    this.scene.add(new T.HemisphereLight(0xc6ecff,0xad8b60,1.8));const sun=new T.DirectionalLight(0xffe2ab,2.8);sun.position.set(-28,42,15);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-20,right:20,top:28,bottom:-26,near:1,far:100});sun.shadow.bias=-.0005;sun.shadow.normalBias=.045;sun.target.position.set(0,0,-16);this.scene.add(sun,sun.target);
    // Distant skyline uses a separate compact group behind the generated district.
    this.skyline=new T.Group();const rand=rng(899);for(let i=0;i<36;i++){const x=(rand()-.5)*260,h=12+rand()*57,z=-140-rand()*100;box(this.skyline,7+rand()*10,h,8+rand()*12,x,h/2-2,z,[0x9fbab7,0xacc7c3,0xb3c7bd][i%3]);if(i%5===0)cyl(this.skyline,.09,.25,10,x,h+4,z,0x819e9d);}this.scene.add(this.skyline);
    this.world=new WorldGenerator(this.scene);this.menuTrain=this.world.templates.get('train').clone();this.menuTrain.position.set(-3.25,0,-11);this.scene.add(this.menuTrain);this.rig=characterModel();this.character=this.rig||courier();this.scene.add(this.character.root);this.drone=drone();this.scene.add(this.drone);
    this.shadow=new T.Mesh(new T.PlaneGeometry(2,2.1),new T.MeshBasicMaterial({map:shadowTexture(),transparent:true,depthWrite:false}));this.shadow.rotation.x=-Math.PI/2;this.scene.add(this.shadow);
    this.board=new T.Group();box(this.board,.75,.14,1.5,0,0,0,0x694f72,true);box(this.board,.6,.035,1.15,0,.085,0,0xe5afd9,true);for(const x of [-.28,.28])box(this.board,.04,.04,1.12,x,-.08,0,mat(0x75ffe4,{emissive:0x5effd3,emissiveIntensity:1.2}));this.scene.add(this.board);this.board.visible=false;
    this.bubble=new T.Mesh(new T.SphereGeometry(1.45,24,16),new T.MeshBasicMaterial({color:0x83caff,transparent:true,opacity:.12,wireframe:true,depthWrite:false}));this.scene.add(this.bubble);this.bubble.visible=false;
    this.particles=new ParticleManager(this.scene);this.ui=new UIManager(this);this.input();this.motion();this.world.step(0,this);this.world.renderTokens(this);$('loading').remove();this.last=performance.now();this.frame=this.frame.bind(this);requestAnimationFrame(this.frame);
  }
  input(){window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['arrowleft','arrowright','arrowup','arrowdown',' ','escape'].includes(k))e.preventDefault();if(e.repeat)return;if(k==='f'){this.fullscreen();return;}if(k==='m'){$('audio').click();return;}if(k==='escape'){if(this.state==='playing')this.pause();else if(this.state==='paused')this.resume();return;}if(this.state!=='playing'){if((k===' '||k==='enter')&&(this.state==='menu'||this.state==='over')){this.audio.start();this.start();}return;}if(this.player.fall)return;if(k==='a'||k==='arrowleft')this.steer(-1);if(k==='d'||k==='arrowright')this.steer(1);if(['w','arrowup',' '].includes(k))this.hop();if(k==='s'||k==='arrowdown')this.crouch();});
    window.addEventListener('resize',()=>{this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.6,1920/innerWidth,1080/innerHeight));this.renderer.setSize(innerWidth,innerHeight);});window.addEventListener('blur',()=>{if(this.state==='playing'&&!this.awaitingCamera)this.pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.state==='playing')this.pause();});window.addEventListener('beforeunload',()=>this.persist());
  }
  motion(){
    const panel=$('motionpanel'),button=$('motion'),label=$('motionstatus'),lanes=$('motionlanes').children;
    const view=$('motionview'),paint=view.getContext('2d');
    const WORDS={off:'Camera off',starting:'Requesting camera…',loading:'Loading tracker…',
      calibrating:'Hold still — centring',searching:'Step into view',tracking:'Lean to steer'};
    const control=createMotionControl(this,(status,detail,head)=>{
      const denied=detail==='denied';
      label.textContent=status==='error'?(denied?'Camera blocked — keyboard still works':'Camera unavailable'):WORDS[status]||status;
      label.className='motionstatus'+(status==='error'?' bad':status==='searching'||status==='calibrating'?' warn':'');
      button.classList.toggle('on',control.active);
      panel.classList.toggle('hidden',!control.active&&status!=='error');
      for(let i=0;i<3;i++)lanes[i].classList.toggle('on',control.active&&i===this.player.lane);
      if(!control.active||!control.video.videoWidth){paint.clearRect(0,0,160,120);return;}
      // The self-view only has to reassure the player that tracking is live, so
      // it is repainted at half the detection rate to keep work off the frame.
      if((this.previewTick=(this.previewTick||0)+1)%2)return;
      // Mirrored, so the preview behaves like a mirror and matches the control.
      paint.save();paint.translate(160,0);paint.scale(-1,1);
      paint.drawImage(control.video,0,0,160,120);paint.restore();
      const box=previewBox(head,160,120);
      if(box){paint.strokeStyle='#c6f578';paint.lineWidth=2;paint.strokeRect(box.x,box.y,box.w,box.h);}
    });
    this.motionControl=control;
    button.addEventListener('click',()=>{this.audio.play('ui');control.toggle();});
    addEventListener('keydown',e=>{const k=e.key.toLowerCase();
      if(k==='c'&&!e.repeat)control.toggle();
      if(k==='r'&&!e.repeat&&control.active)control.recalibrate();});
  }
  // Every input source goes through these, so the keyboard and the camera can
  // never drift apart on guards, audio or lane clamping.
  steer(dir){if(!this.accepting())return;this.player.move(dir);}
  steerTo(lane){if(!this.accepting())return;const next=Math.max(0,Math.min(2,lane));if(next!==this.player.lane)this.player.move(next-this.player.lane);}
  hop(){if(!this.accepting())return;if(this.player.jump())this.audio.play('jump');}
  crouch(){if(!this.accepting())return;this.player.duck();this.audio.play('slide');}
  accepting(){return this.state==='playing'&&!this.player.fall;}
  fullscreen(){if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});else document.documentElement.requestFullscreen().catch(()=>this.toast('FULLSCREEN UNAVAILABLE','Try opening the game in your desktop browser'));}
  start(){this.audio.start();this.distance=0;this.score=0;this.tokens=0;this.speed=17;this.time=0;this.threat=0;this.glance=0;this.shake=0;this.pendingDeath=0;this.chain=0;this.lastToken=0;this.newBest=false;this.roofTimer=0;this.accum=0;this.player.reset();for(const k in this.power)this.power[k]=0;this.world.reset(2039+(this.seed++)*919);this.state='playing';this.ui.state(this.state);this.ui.lastUpdate=1;this.ui.update(0);this.toast('DELIVERY IN MOTION','Follow the flux. Find your line.',2.5);}
  pause(){if(this.state!=='playing')return;this.state='paused';this.ui.state('paused');this.persist();}
  resume(){this.state='playing';this.ui.state('playing');this.last=performance.now();this.accum=0;}
  menu(){this.persist();this.state='menu';this.distance=0;this.player.reset();this.world.reset(2039);this.world.step(0,this);this.world.renderTokens(this);this.ui.state('menu');this.toastTime=0;$('toast').classList.remove('show');}
  persist(){this.save.data.best=Math.max(this.save.data.best,Math.floor(this.score));this.save.save();}
  end(){if(this.state!=='playing')return;this.newBest=this.score>this.save.data.best;this.persist();this.state='over';this.ui.state('over');this.ui.result();this.toastTime=0;$('toast').classList.remove('show');}
  toast(text,sub='',duration=1.5){$('toast').innerHTML=`${text}${sub?'<small>'+sub+'</small>':''}`;$('toast').classList.add('show');this.toastTime=duration;}
  stat(key,n){this.save.data[key]+=n;for(const m of MISSIONS){if(!this.completed.has(m.key)&&this.save.data[m.key]>=m.target){this.completed.add(m.key);this.multiplier=1+this.completed.size;this.toast('DELIVERY COMPLETE',`${m.text} · multiplier ×${this.multiplier}`,2.6);this.audio.play('power');this.save.save();}}}
  collect(token){this.tokens++;this.stat('totalTokens',1);this.score+=10*this.multiplier*(this.power.boost>0?2:1);this.chain=this.time-this.lastToken<1.2?this.chain+1:1;this.lastToken=this.time;this.audio.play('token',this.chain);this.particles.burst(token.x,token.y,0,0xcaff8c,5);$('tokens').classList.remove('tokenpop');void $('tokens').offsetWidth;$('tokens').classList.add('tokenpop');if(this.chain>0&&this.chain%20===0)this.bonus(100,'FLUX STREAK');}
  bonus(points,label){this.score+=points*this.multiplier;if(this.toastTime<.3)this.toast(label,`+${points*this.multiplier}`,1.0);}
  activate(type){this.power[type]=this.powerDuration[type];this.stat('powers',1);this.particles.burst(this.player.x,this.player.y+1,0,POWER_COLORS[type],25);this.audio.play('power');this.toast(POWER_NAMES[type].toUpperCase(),type==='shield'?'One collision covered':`${this.powerDuration[type]} seconds of extra possibility`,2);}
  hit(hard,e){const p=this.player;
    if(this.power.board>0){this.power.board=0;p.invincible=2.2;p.stumble=.4;this.particles.burst(p.x,.3,0,0xe8a4ed,30);this.audio.play('hit');this.toast('BOARD SACRIFICED','Still on schedule.',1.5);this.shake=.18;return;}
    if(this.power.shield>0){this.power.shield=0;p.invincible=2.2;this.particles.burst(p.x,1,0,0x8fd4ff,30);this.audio.play('power');this.toast('IMPACT ABSORBED','Keep moving.',1.4);this.shake=.13;return;}
    this.audio.play('hit');this.shake=.4;p.stumble=1;p.invincible=1.4;this.particles.burst(p.x,1,0,0xffa574,22);$('flash').style.opacity='.8';setTimeout(()=>$('flash').style.opacity='0',180);
    if(hard||this.threat>0){this.pendingDeath=.6;this.threat=10;this.toast('SECURITY INTERCEPT','',.65);}else{this.threat=8;this.speed=Math.max(14,this.speed-3);this.toast('SHAKE IT OFF','Security is closing in.',1.8);}
  }
  step(dt){this.time+=dt;this.clock+=dt;
    if(this.state==='playing'){
      if(this.pendingDeath>0){this.pendingDeath-=dt;if(this.pendingDeath<=0){this.end();return;}}
      this.speed+=(Math.min(MAX_SPEED,17+this.distance*.005)-this.speed)*dt*1.5;const travel=this.speed*dt*(this.pendingDeath>0?.25:1);this.distance+=travel;this.score+=travel*(this.speed/17)*this.multiplier*(this.power.boost>0?2:1);this.stat('totalDistance',travel);this.threat=Math.max(0,this.threat-dt);
      for(const k in this.power){if(this.power[k]>0){this.power[k]=Math.max(0,this.power[k]-dt);if(this.power[k]===0){this.audio.play('expire');this.toast(POWER_NAMES[k].toUpperCase(),'Signal expired',1);}}}
      this.world.step(dt,this);const surface=this.world.surface(this.player,this.distance);if(this.player.step(dt,surface,this.power.board>0)==='land'){this.audio.play('land');this.shake=Math.max(this.shake,.05);this.particles.burst(this.player.x,this.player.y+.1,0,0xd8c6a2,9);}
      if(this.pendingDeath<=0)this.collision.update(this,dt);if(this.player.fall&&this.player.y< -3)this.end();
      this.audio.update(dt,this.speed,this.player.grounded&&this.player.slide<=0&&this.power.board<=0);
      if(this.power.board>0&&Math.random()<dt*28)this.particles.burst(this.player.x,this.player.y+.05,.65,0xb7f6dc,1);
      this.saveTimer+=dt;if(this.saveTimer>20){this.saveTimer=0;this.persist();}
      this.ui.update(dt);
    }
    if(this.toastTime>0){this.toastTime-=dt;if(this.toastTime<=0)$('toast').classList.remove('show');}
    this.shake=Math.max(0,this.shake-dt*1.1);this.glance=Math.max(0,this.glance-dt);this.particles.step(dt,this.state==='playing'?this.speed:0);
  }
  render(dt){const p=this.player,menu=this.state==='menu',active=this.state==='playing';
    this.menuTrain.visible=menu;this.character.root.scale.setScalar(menu?1.3:1);
    if(menu)this.character.root.position.set(2.5,0,2.4);
    else this.character.root.position.set(p.x,p.y+(this.power.board>0?.15:0),0);
    if(this.rig){
      // The clips carry their own upper-body lean, so only a light yaw is added
      // on a lane change; on the menu the dancer is turned to face the camera.
      this.character.root.rotation.y=menu?Math.PI-.45:p.lean*.45;
      this.rig.pose(this.state,p,this.power,this.time,this.speed,this.glance);this.rig.update(dt);
    }else if(menu){this.character.root.rotation.y=2.65;animateCourier(this.character,{...p,grounded:false,lean:0,slide:0,land:0},this.time*.15,0);this.character.arms[0].rotation.x=-.22;this.character.arms[1].rotation.x=.15;this.character.legs.forEach(({leg,shin})=>{leg.rotation.x=0;shin.rotation.x=0;});this.character.hips.position.y=1+Math.sin(this.time*2)*.015;}
    else{this.character.root.rotation.y=0;if(active)animateCourier(this.character,p,this.time,this.speed,this.power.board>0);}
    this.shadow.position.set(this.character.root.position.x,menu?.035:p.surface+.035,menu?2.4:0);this.shadow.scale.setScalar(Math.max(.45,1-(p.y-p.surface)*.1));this.shadow.material.opacity=clamp(1-(p.y-p.surface)*.15,.2,1);
    this.board.visible=!menu&&this.power.board>0;this.board.position.set(p.x,p.y+.1,0);this.board.rotation.z=p.lean;this.bubble.visible=!menu&&this.power.shield>0;this.bubble.position.set(p.x,p.y+1.2,0);this.bubble.rotation.y=this.time*.3;
    this.character.root.visible=!(p.invincible>0&&Math.floor(this.time*18)%3===0);
    this.drone.visible=menu||this.time<4||this.threat>0||this.state==='over';const droneZ=this.state==='over'?1.1:this.threat>0?2.5:5.2;this.drone.position.x+=((menu?-.8:p.x+.7)-this.drone.position.x)*(1-Math.exp(-dt*5));this.drone.position.y=(menu?3.6:2.6)+Math.sin(this.time*3)*.12;this.drone.position.z=menu?0:droneZ;this.drone.rotation.z=Math.sin(this.time*4)*.08;
    let camX,camY,camZ,lookX,lookY,lookZ;
    if(menu){camX=-.6+Math.sin(this.time*.12)*.15;camY=3.6;camZ=10;lookX=-2;lookY=1.8;lookZ=-9;}else{camX=p.x*.22;camY=5.65+p.y*.35+Math.sin(this.time*this.speed*.7)*.025;camZ=10.7+(this.speed-17)*.045;lookX=p.x*.17;lookY=1.25+p.y*.22;lookZ=-13;}
    const ease=1-Math.exp(-dt*(menu?2:5));this.camera.position.lerp(new T.Vector3(camX,camY,camZ),ease);this.look.lerp(new T.Vector3(lookX,lookY,lookZ),ease);if(active&&this.shake>0){this.camera.position.x+=(Math.random()-.5)*this.shake*.28;this.camera.position.y+=(Math.random()-.5)*this.shake*.2;}this.camera.lookAt(this.look);const fov=menu?54:56+(this.speed-17)*.45;this.camera.fov+=(fov-this.camera.fov)*ease;this.camera.updateProjectionMatrix();
    this.world.renderTokens(this);this.renderer.render(this.scene,this.camera);
  }
  frame(now){const dt=Math.min((now-this.last)/1000,.1);this.last=now;if(!this.testClock&&this.state!=='paused'&&this.state!=='over'){this.accum+=dt;while(this.accum>=1/120){this.step(1/120);this.accum-=1/120;}}this.render(dt);requestAnimationFrame(this.frame);}
  snapshot(){return {state:this.state,distance:this.distance,score:this.score,tokens:this.tokens,speed:this.speed,multiplier:this.multiplier,player:{...this.player},power:{...this.power},threat:this.threat,generated:this.world.generated,entities:this.world.entities.length,collectibles:this.world.tokens.length,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,best:this.save.data.best};}
}

(async()=>{try{await Promise.all([prepareTrainAsset(),prepareCityBuildingAsset(),prepareCharacterAsset(),prepareRailAsset(),prepareCityAsset(),prepareTreeAsset()]);indexBuildings();const game=new Game();if(new URLSearchParams(location.search).has('qa'))window.__rail={game,motion:()=>game.motionControl,motionSignal:createMotionSignal,normaliseHead,previewBox,prepareTracker,requestHead,snapshot:()=>game.snapshot(),advance(seconds){const n=Math.ceil(seconds*120);for(let i=0;i<n;i++)game.step(1/120);game.render(1/60);return game.snapshot();},clear(){for(const e of game.world.entities)game.world.recycle(e);game.world.entities=[];game.world.tokens=[];for(const p of game.world.powers)game.scene.remove(p.model);game.world.powers=[];game.world.next=game.distance+10000;},spawn(type,lane,ahead){return game.world.addEntity(type,lane,game.distance+ahead).type;},power:type=>game.activate(type)};}catch(error){console.error(error);const l=$('loading');if(l)l.innerHTML='<b>NEON RAIL</b><p>Could not load the game.</p><p>Enable hardware acceleration in your browser and reopen the game.</p>';}})();
