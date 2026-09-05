from playwright.sync_api import sync_playwright
from pathlib import Path
import sys,json
sys.stdout.reconfigure(encoding='utf-8')
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True,args=['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist'])
    page=b.new_page(viewport={'width':1200,'height':800})
    errs=[]; page.on('pageerror',lambda e:errs.append(str(e)))
    page.goto(Path('outputs/neon-rail/NEON RAIL.html').resolve().as_uri()+'?qa',wait_until='networkidle')
    page.wait_for_function('!!window.__rail')
    page.evaluate('__rail.game.testClock=true')
    r=page.evaluate("""()=>{const g=__rail.game;
      g.start();__rail.clear();g.audio.enabled=false;
      const e=g.world.addEntity('hurdle',2,g.distance+34);
      g.player.lane=2;g.player.x=3.25;let sw=false;
      for(let i=0;i<7*120;i++){g.step(1/120);g.render(1/60);
        const d=g.distance-e.s; if(!sw&&d>-1.0){g.player.move(-1);sw=true;}
        if(g.glance>0.55)break;}
      for(let i=0;i<24;i++){g.render(1/60);}
      return {glance:+g.glance.toFixed(2),near:e.near};}""")
    print(json.dumps(r),flush=True)
    page.wait_for_timeout(250); page.screenshot(path='work/glance.png'); print('wrote work/glance.png',flush=True)
    print('errors:',errs[:3],flush=True)
    b.close()
