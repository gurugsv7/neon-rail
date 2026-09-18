import {createMotionSignal} from './motion-signal.js';
export const BODY_LINKS=[[11,12],[11,23],[12,24],[23,24],[11,13],[13,15],[12,14],[14,16],[23,25],[25,27],[24,26],[26,28]];
const required=[0,11,12,23,24,25,26,27,28];
const visible=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(p.visibility??0)>.6&&p.x>.02&&p.x<.98&&p.y>.02&&p.y<.98;
export function bodyFrame(points){
  if(!points?.length)return {guide:'view'};
  const p=points,torso=[11,12,23,24].every(i=>visible(p[i]));
  const x=torso?1-(p[23].x+p[24].x)/2:.5;
  if(x<.25)return {guide:'right'};
  if(x>.75)return {guide:'left'};
  if(!required.every(i=>visible(p[i])))return {guide:torso?'back':'view'};
  const top=p[0].y-.055,bottom=Math.max(p[27].y,p[28].y),height=bottom-top;
  if(top<.025||bottom>.955||height>.88)return {guide:'back'};
  if(height<.48)return {guide:'forward'};
  const hipY=(p[23].y+p[24].y)/2,shoulderY=(p[11].y+p[12].y)/2;
  return {guide:'fit',x,hipY,shoulderY,height,unit:Math.max(.08,Math.abs(p[11].x-p[12].x)),leg:Math.max(.12,bottom-hipY)};
}
export function createBodySignal(){
  let base=null,hold=null,holdSince=0,lastSeen=-Infinity,lastStep=-Infinity,lastSide=0,steps=[],raised=false,gestureSince=0,gesture=null;
  const steering=createMotionSignal({enter:.42,exit:.23,positional:false});
  const reset=()=>{base=hold=null;steps=[];lastStep=-Infinity;lastSide=0;raised=false;gesture=null;steering.recentre();};
  function update(points,now){
    const f=bodyFrame(points),intents=[];
    if(f.guide!=='fit'){
      hold=null;steps=[];lastStep=-Infinity;
      if(now-lastSeen>700){base=null;lastSide=0;steering.recentre();}
      return {guide:f.guide,running:false,ready:false,intents,steps:0};
    }
    if(now-lastSeen>900&&lastSeen!==-Infinity)reset();lastSeen=now;
    if(!base){
      if(f.x<.39){hold=null;return {guide:'right',running:false,intents,steps:0};}
      if(f.x>.61){hold=null;return {guide:'left',running:false,intents,steps:0};}
      if(!hold||Math.abs(f.x-hold.x)>.035||Math.abs(f.hipY-hold.hipY)>.025){hold=f;holdSince=now;}
      if(now-holdSince>=1000){base=f;steering.calibrate({x:f.x,y:.5,unit:f.unit});}
      return {guide:'still',running:false,ready:!!base,intents,steps:0,progress:Math.min(1,(now-holdSince)/1000)};
    }
    const p=points;
    // Hip-relative alternating knee AND ankle lifts reject head bobbing,
    // torso sway, both-feet bouncing and one knee held in the air.
    const knee=(p[26].y-p[25].y)/f.leg,ankle=(p[28].y-p[27].y)/f.leg;
    const side=knee>.09&&ankle>.045?1:knee<-.09&&ankle<-.045?-1:0;
    if(side&&side!==lastSide&&now-lastStep>=180){
      if(now-lastStep>1500)steps=[];
      steps.push(now);lastStep=now;lastSide=side;
    }
    steps=steps.filter(t=>now-t<2400);
    let running=steps.length>=3&&now-lastStep<1200;
    const out=steering.update({x:f.x,y:.5,unit:f.unit},now);
    intents.push(...out.intents.filter(i=>i.type==='lane'));
    // Hands-up jumping avoids turning ordinary jogging bounce into jumps.
    const handsUp=[15,16].every(i=>visible(p[i])&&p[i].y<f.shoulderY-.08);
    const crouch=f.hipY-base.hipY>base.height*.10&&f.shoulderY-base.shoulderY>base.height*.10;
    const want=handsUp?'jump':crouch?'duck':null;
    if(!want){raised=false;gesture=null;}
    else if(want!==gesture){gesture=want;gestureSince=now;}
    else if(!raised&&now-gestureSince>160&&running){raised=true;intents.push({type:want});}
    // Short allowance to finish an intentional action without freezing in-air.
    if(want&&raised&&now-gestureSince<900&&steps.length>=2)running=true;
    return {guide:running?'running':'jog',ready:true,running,intents,steps:steps.length,posture:raised&&crouch?'duck':'neutral'};
  }
  return {update,reset};
}
