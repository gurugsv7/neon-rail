from playwright.sync_api import sync_playwright
from pathlib import Path
import sys, json
sys.stdout.reconfigure(encoding='utf-8')

# End-to-end camera path. Two halves:
#  1) does BlazeFace actually fire on a drawn face, and does moving that face
#     physically left steer the character to the left lane;
#  2) does the real getUserMedia -> tracker -> loop plumbing come up.

DETECT = r"""
async ()=>{
  await __rail.prepareTracker();
  // A crude but face-shaped target: BlazeFace keys off the eyes/nose/mouth
  // arrangement, so draw one rather than a plain ellipse.
  const cv=document.createElement('canvas'); cv.width=640; cv.height=480;
  const cx=cv.getContext('2d');
  const drawFace=(fx,fy,r)=>{
    cx.fillStyle='#5b6b7a'; cx.fillRect(0,0,640,480);
    cx.fillStyle='#e0b48c'; cx.beginPath(); cx.ellipse(fx,fy,r*0.78,r,0,0,7); cx.fill();
    cx.fillStyle='#2b2118';
    cx.beginPath(); cx.ellipse(fx-r*0.3,fy-r*0.18,r*0.11,r*0.07,0,0,7); cx.fill();
    cx.beginPath(); cx.ellipse(fx+r*0.3,fy-r*0.18,r*0.11,r*0.07,0,0,7); cx.fill();
    cx.fillRect(fx-r*0.42,fy-r*0.36,r*0.26,r*0.05);
    cx.fillRect(fx+r*0.16,fy-r*0.36,r*0.26,r*0.05);
    cx.strokeStyle='#8d5f45'; cx.lineWidth=Math.max(2,r*0.05);
    cx.beginPath(); cx.moveTo(fx,fy-r*0.08); cx.lineTo(fx,fy+r*0.16); cx.stroke();
    cx.strokeStyle='#7d3f36'; cx.lineWidth=Math.max(2,r*0.07);
    cx.beginPath(); cx.arc(fx,fy+r*0.24,r*0.28,0.15*Math.PI,0.85*Math.PI); cx.stroke();
    cx.fillStyle='#26343f'; cx.beginPath(); cx.ellipse(fx,fy-r*0.62,r*0.85,r*0.42,0,Math.PI,2*Math.PI); cx.fill();
  };
  const probe=(fx)=>new Promise(function(done){ drawFace(fx,220,95);
    if(!__rail.requestHead(cv,done)) done(null); });
  // warm-up frame; the first inference is always the slow one
  await probe(320);
  const centre=await probe(320), rawRight=await probe(470), rawLeft=await probe(170);
  return {
    detected: !!centre,
    centre: centre && {x:+centre.x.toFixed(3), unit:+centre.unit.toFixed(3)},
    rawRight: rawRight && +rawRight.x.toFixed(3),   // player's own LEFT
    rawLeft:  rawLeft  && +rawLeft.x.toFixed(3),    // player's own RIGHT
  };
}
"""

STEER = r"""
async ()=>{
  // Drive the real signal with the real detector output: a face moving toward
  // the raw image's right is the player moving to their own left, and must end
  // in lane 0.
  const cv=document.createElement('canvas'); cv.width=640; cv.height=480;
  const cx=cv.getContext('2d');
  const drawFace=(fx)=>{
    const fy=220,r=95;
    cx.fillStyle='#5b6b7a'; cx.fillRect(0,0,640,480);
    cx.fillStyle='#e0b48c'; cx.beginPath(); cx.ellipse(fx,fy,r*0.78,r,0,0,7); cx.fill();
    cx.fillStyle='#2b2118';
    cx.beginPath(); cx.ellipse(fx-r*0.3,fy-r*0.18,r*0.11,r*0.07,0,0,7); cx.fill();
    cx.beginPath(); cx.ellipse(fx+r*0.3,fy-r*0.18,r*0.11,r*0.07,0,0,7); cx.fill();
    cx.fillRect(fx-r*0.42,fy-r*0.36,r*0.26,r*0.05);
    cx.fillRect(fx+r*0.16,fy-r*0.36,r*0.26,r*0.05);
    cx.strokeStyle='#8d5f45'; cx.lineWidth=5; cx.beginPath(); cx.moveTo(fx,fy-8); cx.lineTo(fx,fy+15); cx.stroke();
    cx.strokeStyle='#7d3f36'; cx.lineWidth=7; cx.beginPath(); cx.arc(fx,fy+23,r*0.28,0.15*Math.PI,0.85*Math.PI); cx.stroke();
    cx.fillStyle='#26343f'; cx.beginPath(); cx.ellipse(fx,fy-59,r*0.85,r*0.42,0,Math.PI,2*Math.PI); cx.fill();
  };
  const sig=__rail.motionSignal();
  const g=__rail.game; g.start();
  let t=performance.now(), lanes=[];
  const one=(fx)=>new Promise(function(done){ drawFace(fx);
      if(!__rail.requestHead(cv,done)) done(null); });
  const feed=async(fx,n)=>{ for(let i=0;i<n;i++){ const head=await one(fx); t+=83;
      if(!head) continue;
      const out=sig.update(head,t); lanes.push(out.lane);
      for(const it of out.intents) if(it.type==='lane') g.steerTo(it.lane); } };
  await __rail.prepareTracker();
  await feed(320,10);                        // calibrate at centre
  const afterCentre=g.player.lane;
  await feed(470,16);                        // player leans to their own LEFT
  const afterLeft=g.player.lane;
  await feed(320,14); await feed(170,16);          // back to centre, then their own RIGHT
  const afterRight=g.player.lane;
  return {afterCentre,afterLeft,afterRight,samples:lanes.length};
}
"""

with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True, args=[
        '--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist',
        '--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'])
    page = b.new_page(viewport={'width':1200,'height':800})
    errs=[]; page.on('pageerror', lambda e: errs.append(str(e)))
    reqs=[]; page.on('request', lambda r: reqs.append(r.url))
    page.goto(Path('outputs/neon-rail/NEON RAIL.html').resolve().as_uri()+'?qa', wait_until='networkidle')
    page.wait_for_function('!!window.__rail', timeout=60000)

    det = page.evaluate(DETECT)
    print('face detection:', json.dumps(det), flush=True)

    if det.get('detected'):
        steer = page.evaluate(STEER)
        print('steering:', json.dumps(steer), flush=True)
        good = steer['afterCentre']==1 and steer['afterLeft']==0 and steer['afterRight']==2
        print(('PASS' if good else 'FAIL'), 'physical left -> lane 0, physical right -> lane 2', flush=True)
    else:
        print('SKIP steering test - detector did not fire on the synthetic face', flush=True)

    # plumbing: real getUserMedia through the real controller
    page.evaluate("__rail.game.motionControl.enable()")
    page.wait_for_timeout(6000)
    print('controller:', json.dumps(page.evaluate(
        "({active:__rail.game.motionControl.active,status:__rail.game.motionControl.status})")), flush=True)
    page.evaluate("__rail.game.motionControl.disable()")

    ext=[r for r in reqs if r.startswith('http') or r.startswith('https')]
    print('external requests:', ext, flush=True)
    print('page errors:', errs[:3], flush=True)
    b.close()
