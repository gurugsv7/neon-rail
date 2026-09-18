from pathlib import Path
import json,base64
from playwright.sync_api import sync_playwright
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,args=['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'])
 p=b.new_page(viewport={'width':1440,'height':900});errors=[];requests=[]
 p.on('pageerror',lambda e:errors.append(str(e)));p.on('request',lambda r:requests.append(r.url))
 p.add_init_script("window.Worker=class extends Worker{constructor(...args){super(...args);window.workerCreated=true;this.addEventListener('message',e=>{window.workerMessages=(window.workerMessages||0)+1;window.lastWorkerMeta={type:e.data.type,age:performance.timeOrigin+performance.now()-e.data.capturedAt};if(e.data.type==='head'&&window.qaPose!==undefined)Object.defineProperty(e,'data',{value:{...e.data,head:window.qaPose?{points:window.qaPose}:null}});});}}")
 p.goto('http://127.0.0.1:8765/?qa',wait_until='networkidle');p.wait_for_function('!!window.__rail',timeout=60000)
 assert not any('.task' in r or 'motion-worker.js' in r for r in requests)
 p.evaluate('window.__rail.game.testClock=true;__rail.game.start();__rail.clear()')
 p.locator('#motion').click();p.wait_for_function('__rail.motion().active',timeout=30000)
 assert p.evaluate('__rail.motion().mode')=='body'
 p.wait_for_timeout(1800)
 assert p.locator('#body-gate').is_visible()
 before=p.evaluate('__rail.game.distance');p.evaluate('__rail.advance(3)');assert p.evaluate('__rail.game.distance')==before
 assert any('.task' in r for r in requests)
 p.screenshot(path='work/body-camera-setup.png')
 p.evaluate("window.makePose=()=>{const p=Array.from({length:33},()=>({x:.5,y:.4,visibility:.99}));for(const [i,x,y] of [[0,.5,.13],[11,.42,.28],[12,.58,.28],[23,.45,.53],[24,.55,.53],[25,.45,.71],[26,.55,.71],[27,.45,.9],[28,.55,.9],[15,.35,.5],[16,.65,.5]])Object.assign(p[i],{x,y});return p};window.qaPose=makePose()")
 p.wait_for_function("__rail.motion().status==='jog'",timeout=45000);print('calibration',p.evaluate('({status:__rail.motion().status,created:window.workerCreated,messages:window.workerMessages,last:window.lastWorkerMeta,pose:window.qaPose?.length,hidden:document.hidden})'),errors,flush=True);assert not p.evaluate('__rail.motion().running')
 for side in [25,26,25,26,25]:
  p.evaluate('(side)=>{window.qaPose=makePose();qaPose[side].y-=.065;qaPose[side+2].y-=.07}',side);p.wait_for_timeout(420);print('gait',side,p.evaluate('({status:__rail.motion().status,running:__rail.motion().running,steps:document.querySelectorAll("#body-meter .on").length})'),flush=True)
 assert p.evaluate('__rail.motion().running'),'gait did not reach gameplay controller'
 p.evaluate('__rail.advance(.3)');after=p.evaluate('__rail.game.distance');assert after>before
 p.evaluate('window.qaPose=makePose()');p.wait_for_timeout(1500)
 assert not p.evaluate('__rail.motion().running')
 p.evaluate('__rail.spawn("approach",0,40)');train=p.evaluate('__rail.game.world.entities[0].s')
 p.evaluate('__rail.advance(2)');assert p.evaluate('__rail.game.distance')==after;assert p.evaluate('__rail.game.world.entities[0].s')<train;assert p.evaluate('__rail.game.idleSeconds')>1.9
 p.evaluate('window.qaPose=null');p.wait_for_timeout(200);assert not p.evaluate('__rail.motion().running')
 p.evaluate('delete window.qaPose')
 # Use the worker on an official example image with known full-body content.
 p.evaluate('__rail.motion().disable()')
 p.evaluate("async()=>{await __rail.prepareTracker('body')}")
 src='data:image/png;base64,'+base64.b64encode(Path('work/pose-reference.png').read_bytes()).decode()
 result=p.evaluate('''async src=>{const img=new Image();img.src=src;await img.decode();const c=document.createElement('canvas');c.width=640;c.height=480;c.getContext('2d').drawImage(img,0,0,640,480);const result=await new Promise(async(resolve,reject)=>{const timer=setTimeout(()=>reject(Error('pose timeout')),15000);const accepted=await __rail.requestHead(c,h=>{clearTimeout(timer);resolve(h)});if(!accepted){clearTimeout(timer);reject(Error('capture rejected'))}});return {count:result?.points?.length||0,knees:result?.points?.slice(25,29)}}''',src)
 print('real pose detector',json.dumps(result),flush=True);assert result['count']==33
 # Closing the manually prepared tracker before enabling the other mode.
 p.evaluate('__rail.motion().disable()');p.evaluate("async()=>{await __rail.motion().setMode('head');await __rail.motion().enable()}")
 assert p.evaluate('__rail.motion().active&&!__rail.motion().requiresJog')
 p.evaluate('__rail.advance(.2)');assert p.evaluate('__rail.game.distance')>before
 p.evaluate('__rail.motion().disable()');assert p.evaluate('__rail.motion().video.srcObject===null')
 external=[r for r in requests if r.startswith('http') and not r.startswith('http://127.0.0.1:8765/')]
 print({'errors':errors,'external':external,'gate':True,'headFallback':True},flush=True)
 assert not errors and not external
 b.close()
