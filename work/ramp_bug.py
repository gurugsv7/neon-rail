from playwright.sync_api import sync_playwright
from pathlib import Path
import sys,json
sys.stdout.reconfigure(encoding='utf-8')
# Repro: ride the ramp of a rampTrain and press DOWN partway up. The duck gives
# vy=-15 while the ramp rises to meet the player; if support is withdrawn the
# player drops to ground level and is killed by the train body.
SCRIPT = """
(secs)=>{
  const g=__rail.game;
  g.start(); __rail.clear(); g.audio.enabled=false;
  const e=g.world.addEntity('rampTrain',1,g.distance+60);
  const trace=[];
  let jumped=false,ducked=false;
  for(let i=0;i<secs*120;i++){
    g.step(1/120);
    const p=g.player, d=g.distance-e.s;
    // climb the ramp, jump off it, then fast-fall back down onto the slope
    if(!jumped && p.y>1.2 && d<-11){ g.player.jump(); jumped=true; }
    if(jumped && !ducked && !p.grounded && p.vy<2){ g.player.duck(); ducked=true; trace.push({at:'duck',y:+p.y.toFixed(2),d:+d.toFixed(1)}); }
    if(ducked&&i%6===0) trace.push({y:+p.y.toFixed(2),d:+d.toFixed(1),sur:+p.surface.toFixed(2),hit:e.hit});
    if(g.state!=='playing') break;
  }
  return {jumped,ducked,state:g.state,entityHit:e.hit,
          samples:trace.filter(x=>x.d!==undefined&&x.d>-14&&x.d<9).slice(0,14)};
}
"""
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True,args=['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist'])
    page=b.new_page(viewport={'width':900,'height':600})
    errs=[]; page.on('pageerror',lambda e:errs.append(str(e)))
    page.goto(Path('outputs/neon-rail/NEON RAIL.html').resolve().as_uri()+'?qa',wait_until='networkidle')
    page.wait_for_function('!!window.__rail')
    page.evaluate('__rail.game.testClock=true')
    for seed in range(3):
        r=page.evaluate(SCRIPT,6)
        print(f'run{seed}',json.dumps(r),flush=True)
    print('errors:',errs,flush=True)
    b.close()
