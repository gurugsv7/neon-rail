from playwright.sync_api import sync_playwright
from pathlib import Path
import sys,json
sys.stdout.reconfigure(encoding='utf-8')
SCRIPT = """
(swerveAt)=>{
  const g=__rail.game;
  g.start(); __rail.clear(); g.audio.enabled=false;
  const e=g.world.addEntity('hurdle',2,g.distance+34);
  g.player.lane=2; g.player.x=3.25;
  let swerved=false,peak=0,frames=0,best=null;
  for(let i=0;i<7*120;i++){
    g.step(1/120); g.render(1/60);
    const d=g.distance-e.s, dx=Math.abs(g.player.x-3.25);
    if(!swerved && d>swerveAt){ g.player.move(-1); swerved=true; }
    if(Math.abs(d)<.5 && (best===null||Math.abs(d)<Math.abs(best.d)))best={d:+d.toFixed(2),dx:+dx.toFixed(2)};
    peak=Math.max(peak,g.glance); if(g.glance>0)frames++;
    if(g.state!=='playing')break;
  }
  return {swerveAt,near:e.near,peakGlance:+peak.toFixed(2),framesGlancing:frames,
          atClosest:best,state:g.state};
}
"""
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True,args=['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist'])
    page=b.new_page(viewport={'width':1200,'height':800})
    errs=[]; page.on('pageerror',lambda e:errs.append(str(e)))
    page.goto(Path('outputs/neon-rail/NEON RAIL.html').resolve().as_uri()+'?qa',wait_until='networkidle')
    page.wait_for_function('!!window.__rail')
    page.evaluate('__rail.game.testClock=true')
    hit=None
    for at in (-1.6,-1.2,-1.0,-0.8,-0.6,-0.4,-0.2):
        r=page.evaluate(SCRIPT,at)
        print(json.dumps(r),flush=True)
        if r['near'] and hit is None: hit=at
    print('first swerve point that produced a close call:',hit,flush=True)
    print('errors:',errs[:3],flush=True)
    b.close()
