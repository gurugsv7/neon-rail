from playwright.sync_api import sync_playwright
from pathlib import Path
import sys,json
sys.stdout.reconfigure(encoding='utf-8')
# Ramp support is granted only within 1.18 of the lane centre, but the train
# body hits out to 1.42. A player still sliding between lanes sits in that band:
# no ramp under them, but fully hittable.
SCRIPT = """
(switchAt)=>{
  const g=__rail.game;
  g.start(); __rail.clear(); g.audio.enabled=false;
  g.player.lane=0; g.player.x=-3.25;                 // start left of the ramp
  const e=g.world.addEntity('rampTrain',1,g.distance+70);
  const trace=[]; let switched=false;
  for(let i=0;i<8*120;i++){
    g.step(1/120);
    const p=g.player,d=g.distance-e.s;
    if(!switched && d>switchAt){ g.player.move(1); switched=true; }   // slide onto the ramp lane
    if(switched && i%5===0 && d>-24 && d<10)
      trace.push({d:+d.toFixed(1),x:+p.x.toFixed(2),y:+p.y.toFixed(2),sur:+p.surface.toFixed(2)});
    if(g.state!=='playing') break;
  }
  return {switchAt,state:g.state,died:g.state!=='playing',entityHit:e.hit,
          droppedOffRamp:trace.some(t=>t.d>-19&&t.d<-8&&t.y<.5),
          trace:trace.slice(0,12)};
}
"""
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True,args=['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist'])
    page=b.new_page(viewport={'width':900,'height':600})
    errs=[]; page.on('pageerror',lambda e:errs.append(str(e)))
    page.goto(Path('outputs/neon-rail/NEON RAIL.html').resolve().as_uri()+'?qa',wait_until='networkidle')
    page.wait_for_function('!!window.__rail')
    page.evaluate('__rail.game.testClock=true')
    for at in (-21,-19,-17,-15,-13,-11,-9,-8):
        r=page.evaluate(SCRIPT,at)
        print(f"switchAt={at:4d} died={r['died']} hit={r['entityHit']}",flush=True)
    
    print('errors:',errs,flush=True)
    b.close()
