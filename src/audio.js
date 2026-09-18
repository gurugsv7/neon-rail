import runTrack1 from '../assets/meridian-run-1.mp3';
import runTrack2 from '../assets/meridian-run-2.mp3';
import runTrack3 from '../assets/meridian-run-3.mp3';

const MUSIC_TRACKS=[runTrack1,runTrack2,runTrack3];

// Mix levels.
//
// The three tracks are mastered to -17.9 LUFS integrated with a -1.5 dBTP
// ceiling (EBU R128 two-pass, done at build time -- the sources arrived at
// -12.4 LUFS peaking at +0.5 dBFS, i.e. already clipping). Short-term
// loudness on material like this runs roughly 2 LU above integrated, so call
// the bed -16 at unity gain.
//
// The cues it must never mask are the ones the player acts on: the train horn
// and a jump peak at about -23.5 dBFS, a token at -27. Game-audio practice is
// to sit a music bed 6-12 dB under those; 0.15 linear lands the bed near
// -32 dB, about 9 dB down -- the middle of that range.
const MUSIC_GAIN=.15;
// A further -4 dB while a warning or an impact is sounding, grabbed quickly
// and released slowly, so the horn cuts through without the music pumping.
const DUCK_GAIN=.63,DUCK_HOLD=.7;
const CROSSFADE=2.2,FADE_IN=1.1,FADE_OUT=.9;

export class AudioManager{
  constructor(){
    this.enabled=true;this.ctx=null;this.beat=0;this.stepTime=0;this.trainTime=0;
    this.tracks=null;this.lastPlayed=-1;this.held=false;
    this.music={order:[],slot:0,current:-1,next:-1,fading:false,fade:0,level:0,target:0,duck:1,duckFor:0};
  }
  start(){if(!this.ctx)this.ctx=new (window.AudioContext||window.webkitAudioContext)();this.ctx.resume();}
  tone(freq,duration=.12,type='sine',volume=.05,end){if(!this.enabled||!this.ctx)return;const t=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(end)o.frequency.exponentialRampToValueAtTime(end,t+duration);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(volume,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(this.ctx.destination);o.start(t);o.stop(t+duration+.01);}
  noise(duration=.15,volume=.05,filter=1000){if(!this.enabled||!this.ctx)return;const n=this.ctx.sampleRate*duration,b=this.ctx.createBuffer(1,n,this.ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);const s=this.ctx.createBufferSource(),g=this.ctx.createGain(),f=this.ctx.createBiquadFilter();s.buffer=b;f.type='lowpass';f.frequency.value=filter;g.gain.value=volume;s.connect(f);f.connect(g);g.connect(this.ctx.destination);s.start();}
  play(kind,chain=0){
    // Anything the player has to react to pulls the bed down under itself.
    if(kind==='horn'||kind==='hit'||kind==='power')this.duck();
    switch(kind){case 'token':this.tone(660+(chain%7)*75,.13,'sine',.045,1100+(chain%7)*80);break;case 'jump':this.tone(170,.18,'triangle',.065,460);break;case 'land':this.noise(.1,.12,450);break;case 'slide':this.noise(.35,.07,2600);break;case 'hit':this.noise(.4,.17,800);this.tone(130,.3,'sawtooth',.065,38);break;case 'power':[440,554,660,880].forEach((f,i)=>setTimeout(()=>this.tone(f,.22,'triangle',.065),i*60));break;case 'expire':this.tone(500,.3,'triangle',.03,180);break;case 'horn':this.tone(155,.65,'sawtooth',.027);this.tone(207,.65,'triangle',.04);break;case 'ui':this.tone(550,.1,'triangle',.05,850);break;case 'near':this.noise(.16,.055,3500);break;}
  }
  update(dt,speed,grounded){
    this.stepTime+=dt;this.beat+=dt;
    if(grounded&&this.stepTime>5.7/speed){this.stepTime=0;this.noise(.045,.035,600);}
    // The synthesised bass-and-hat bed is the fallback for when the tracks are
    // not playing -- on the menu, or if they failed to load. Two beds at once
    // would just be mud.
    if(this.musicActive)return;
    if(this.beat>.39){this.beat=0;this.seq=(this.seq||0)+1;const bass=[110,110,146.83,130.81,110,164.81,146.83,98][Math.floor(this.seq/8)%8];if(this.seq%2===0)this.tone(bass,.25,'triangle',.026);if(this.seq%4===0)this.tone(55,.15,'sine',.055,30);if(this.seq%2)this.noise(.035,.018,5200);if(this.seq%4===2)this.tone(bass*4,.13,'sine',.014);}
  }

  // Music ---------------------------------------------------------------
  //
  // Streamed through <audio> elements rather than decodeAudioData: each track
  // is about three minutes, which decodes to ~62 MB of float32, and holding
  // all three would cost 185 MB of memory to play seven megabytes of MP3.
  // Volume rides on element.volume, which also keeps this working from
  // file:// -- a MediaElementAudioSourceNode on a file:// URL is treated as
  // cross-origin and outputs silence.
  get musicActive(){return !!this.tracks&&this.music.current>=0&&this.music.level>0;}
  buildTracks(){
    if(this.tracks)return;
    this.tracks=MUSIC_TRACKS.map(src=>{const el=new Audio();el.src=src;el.preload='auto';el.loop=false;el.volume=0;return el;});
  }
  // Shuffled per run, and never opening on the track the last run used, so a
  // player who dies early does not hear the same eight bars over and over.
  shuffleOrder(){
    const order=[0,1,2];
    for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
    if(order[0]===this.lastPlayed)[order[0],order[1]]=[order[1],order[0]];
    return order;
  }
  startMusic(){
    this.buildTracks();this.haltMusic();
    const m=this.music;
    m.order=this.shuffleOrder();m.slot=0;m.current=m.order[0];m.next=-1;
    m.fading=false;m.fade=0;m.level=0;m.target=1;m.duck=1;m.duckFor=0;
    this.held=false;this.lastPlayed=m.current;
    const el=this.tracks[m.current];el.currentTime=0;el.volume=0;
    // Called from the same gesture that resumes the AudioContext; a rejection
    // here just means no music this run, never a broken game.
    el.play().catch(()=>{});
  }
  advanceMusic(){
    const m=this.music;if(m.fading||!this.tracks)return;
    m.slot=(m.slot+1)%m.order.length;
    m.next=m.order[m.slot];
    if(m.next===m.current)return;
    const el=this.tracks[m.next];el.currentTime=0;el.volume=0;el.play().catch(()=>{});
    m.fading=true;m.fade=0;this.lastPlayed=m.next;
  }
  stopMusic(){this.music.target=0;}
  pauseMusic(){this.held=true;if(this.tracks)for(const el of this.tracks)if(!el.paused)el.pause();}
  resumeMusic(){
    this.held=false;const m=this.music;if(!this.tracks||m.current<0)return;
    this.tracks[m.current].play().catch(()=>{});
    if(m.fading&&m.next>=0)this.tracks[m.next].play().catch(()=>{});
  }
  haltMusic(){
    const m=this.music;
    if(this.tracks)for(const el of this.tracks){el.pause();el.currentTime=0;el.volume=0;}
    m.current=-1;m.next=-1;m.fading=false;m.fade=0;m.level=0;m.target=0;
  }
  duck(seconds=DUCK_HOLD){this.music.duckFor=Math.max(this.music.duckFor,seconds);}
  // Driven from the render loop, not the fixed physics step, so the fade-out
  // still runs while the death animation has the simulation stopped.
  updateMusic(dt){
    const m=this.music;if(!this.tracks||m.current<0)return;
    const want=this.enabled&&!this.held?m.target:0;
    const span=want>m.level?FADE_IN:FADE_OUT;
    m.level=Math.max(0,Math.min(1,m.level+Math.max(-dt/span,Math.min(dt/span,want-m.level))));
    if(m.duckFor>0)m.duckFor-=dt;
    const goal=m.duckFor>0?DUCK_GAIN:1;
    m.duck+=(goal-m.duck)*(1-Math.exp(-dt*(goal<m.duck?15:2.6)));
    const bed=MUSIC_GAIN*m.level*m.duck;
    const cur=this.tracks[m.current];
    if(want>0&&cur.paused)cur.play().catch(()=>{});
    if(m.fading){
      m.fade=Math.min(1,m.fade+dt/CROSSFADE);
      // Equal power, so the handover does not dip in the middle.
      cur.volume=Math.min(1,bed*Math.cos(m.fade*Math.PI/2));
      this.tracks[m.next].volume=Math.min(1,bed*Math.sin(m.fade*Math.PI/2));
      if(m.fade>=1){cur.pause();cur.currentTime=0;cur.volume=0;m.current=m.next;m.next=-1;m.fading=false;}
    }else{
      cur.volume=Math.min(1,bed);
      if(cur.duration&&cur.currentTime>cur.duration-CROSSFADE)this.advanceMusic();
    }
    if(want<=0&&m.level<=0&&m.target<=0)this.haltMusic();
  }
}
