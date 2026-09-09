from playwright.sync_api import sync_playwright
from pathlib import Path
import sys, json
sys.stdout.reconfigure(encoding='utf-8')

# Exercises the real bundled motion code through the ?qa harness, with synthetic
# head samples, so none of this needs a webcam and all of it is deterministic.
SUITE = r"""
()=>{
  const results=[];
  const ok=(name,pass,detail)=>results.push({name,pass:!!pass,detail});

  // ---- mirroring: the classic webcam-control bug -------------------------
  // A player moving to their OWN left travels toward INCREASING x in the raw
  // camera image. That must come out as a SMALLER normalised x, which is the
  // screen-left lane.
  const W=640,H=480,box=(cx)=>({originX:cx-40,originY:200,width:80,height:80});
  const left  = __rail.normaliseHead(box(500),W,H);   // raw right = player's left
  const centre= __rail.normaliseHead(box(320),W,H);
  const right = __rail.normaliseHead(box(140),W,H);   // raw left  = player's right
  ok('mirror: player-left gives smaller x than centre', left.x < centre.x, {left:+left.x.toFixed(3),centre:+centre.x.toFixed(3)});
  ok('mirror: player-right gives larger x than centre', right.x > centre.x, {right:+right.x.toFixed(3)});
  ok('mirror: centre is centred', Math.abs(centre.x-0.5)<1e-6, {x:centre.x});
  ok('unit tracks head width', Math.abs(centre.unit-80/640)<1e-6, {unit:centre.unit});
  ok('null box yields null', __rail.normaliseHead(null,W,H)===null);

  // ---- lane state machine ------------------------------------------------
  // Feed samples at 12Hz the way the real loop does.
  const HZ=12, STEP=1000/HZ;
  const run=(sig,xs,t0)=>{let t=t0,last=null;
    for(const x of xs){last=sig.update({x,y:0.5,unit:0.125},t);t+=STEP;}
    return {last,t};};

  // calibrate at centre, then hold centre: must stay in lane 1
  let sig=__rail.motionSignal();
  let r=run(sig,Array(20).fill(0.5),1000);
  ok('holding centre stays in the middle lane', r.last.lane===1, {lane:r.last.lane});

  // lean left far enough, long enough -> lane 0
  sig=__rail.motionSignal(); run(sig,Array(6).fill(0.5),1000);
  r=run(sig,Array(14).fill(0.5-0.055),1000+6*STEP);   // 0.055/0.125 = 0.44 units, past the 0.32 entry
  ok('a sustained lean left reaches lane 0', r.last.lane===0, {lane:r.last.lane,offset:+r.last.offsetX.toFixed(3)});

  // lean right -> lane 2
  sig=__rail.motionSignal(); run(sig,Array(6).fill(0.5),1000);
  r=run(sig,Array(14).fill(0.5+0.055),1000+6*STEP);
  ok('a sustained lean right reaches lane 2', r.last.lane===2, {lane:r.last.lane,offset:+r.last.offsetX.toFixed(3)});

  // a one-sample spike must NOT steer (dwell time)
  sig=__rail.motionSignal(); run(sig,Array(8).fill(0.5),1000);
  r=run(sig,[0.5-0.12,0.5,0.5,0.5,0.5,0.5],1000+8*STEP);
  ok('a single-frame spike does not steer', r.last.lane===1, {lane:r.last.lane});

  // hysteresis: after committing left, drifting just inside the entry
  // threshold must NOT snap back to centre
  sig=__rail.motionSignal(); run(sig,Array(6).fill(0.5),1000);
  let s2=run(sig,Array(14).fill(0.5-0.055),1000+6*STEP);
  const committed=s2.last.lane;
  r=run(sig,Array(10).fill(0.5-0.0345),s2.t);   // 0.276 units: below entry .32, above exit .20
  ok('hysteresis holds the lane between exit and entry', committed===0 && r.last.lane===0, {lane:r.last.lane,offset:+r.last.offsetX.toFixed(3)});

  // returning past the exit threshold does recentre
  r=run(sig,Array(14).fill(0.5),r.t);
  ok('returning to centre releases the lane', r.last.lane===1, {lane:r.last.lane});

  // ---- vertical ----------------------------------------------------------
  const runXY=(sig,pts,t0)=>{let t=t0,all=[];
    for(const p of pts){const o=sig.update({x:p[0],y:p[1],unit:0.125},t);all.push(...o.intents);t+=STEP;}
    return all;};
  sig=__rail.motionSignal(); runXY(sig,Array(8).fill([0.5,0.5]),1000);
  let intents=runXY(sig,Array(10).fill([0.5,0.5-0.05]),1000+8*STEP);  // head rises
  ok('raising the head fires a jump', intents.some(i=>i.type==='jump'), {intents:intents.map(i=>i.type)});

  sig=__rail.motionSignal(); runXY(sig,Array(8).fill([0.5,0.5]),1000);
  intents=runXY(sig,Array(10).fill([0.5,0.5+0.06]),1000+8*STEP);      // head drops
  ok('lowering the head fires a duck', intents.some(i=>i.type==='duck'), {intents:intents.map(i=>i.type)});

  // ---- tracking loss -----------------------------------------------------
  sig=__rail.motionSignal(); run(sig,Array(8).fill(0.5),1000);
  let t=1000+8*STEP, out=null;
  for(let i=0;i<20;i++){out=sig.update(null,t);t+=STEP;}   // ~1.7s with no face
  ok('losing the face reports tracking lost', out.tracking===false, {tracking:out.tracking});

  // ---- preview overlay ---------------------------------------------------
  // The box is drawn on a MIRRORED self-view, and head.x is already mirrored,
  // so the box must sit at head.x directly. Flipping again put it on the
  // opposite side of the player's face from the player.
  const mk=(x)=>({x, y:0.5, unit:0.2});
  const bL=__rail.previewBox(mk(0.2),160,120);
  const bC=__rail.previewBox(mk(0.5),160,120);
  const bR=__rail.previewBox(mk(0.8),160,120);
  const mid=b=>b.x+b.w/2;
  ok('overlay: box follows head.x, not its mirror', Math.abs(mid(bL)-0.2*160)<0.5, {centre:mid(bL),expected:32});
  ok('overlay: centred head gives a centred box', Math.abs(mid(bC)-80)<0.5, {centre:mid(bC)});
  ok('overlay: box moves the same way as the face', mid(bL)<mid(bC) && mid(bC)<mid(bR),
     {left:mid(bL),centre:mid(bC),right:mid(bR)});
  ok('overlay: box is sized from head width', Math.abs(bC.w-0.2*160)<0.5, {w:bC.w});
  ok('overlay: no head means no box', __rail.previewBox(null,160,120)===null);

  return results;
}
"""

with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True, args=['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist'])
    page = b.new_page(viewport={'width':1200,'height':800})
    errs=[]; page.on('pageerror', lambda e: errs.append(str(e)))
    page.goto(Path('outputs/neon-rail/NEON RAIL.html').resolve().as_uri()+'?qa', wait_until='networkidle')
    page.wait_for_function('!!window.__rail', timeout=60000)
    results = page.evaluate(SUITE)
    npass = sum(1 for r in results if r['pass'])
    for r in results:
        print(('PASS ' if r['pass'] else 'FAIL ') + r['name'],
              '' if r['pass'] else json.dumps(r.get('detail')), flush=True)
    print(f'\n{npass}/{len(results)} passed', flush=True)
    print('page errors:', errs[:3], flush=True)
    b.close()
    sys.exit(0 if npass==len(results) and not errs else 1)
