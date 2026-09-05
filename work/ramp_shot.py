from playwright.sync_api import sync_playwright
from pathlib import Path
import sys,json
sys.stdout.reconfigure(encoding='utf-8')
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True,args=['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist'])
    page=b.new_page(viewport={'width':1600,'height':900})
    errs=[]; page.on('pageerror',lambda e:errs.append(str(e)))
    page.goto(Path('outputs/neon-rail/NEON RAIL.html').resolve().as_uri()+'?qa',wait_until='networkidle')
    page.wait_for_function('!!window.__rail')
    page.get_by_role('button',name='LET’S RUN').click()
    page.evaluate('__rail.game.testClock=true;__rail.game.audio.enabled=false;__rail.clear()')
    # ramp train ahead in the middle lane, plain train beside it for comparison
    page.evaluate('''(()=>{const g=__rail.game;
      // rover in the next lane so it is seen side-on rather than ridden
      const e=g.world.addEntity('rampTrain',2,g.distance+70);
      for(let i=0;i<9*120;i++){g.step(1/120);if(g.distance-e.s>-9)break;}
      g.render(1/60);})()''')
    page.wait_for_timeout(400); page.screenshot(path='work/ramp-train.png'); print('wrote work/ramp-train.png',flush=True)
    print(json.dumps(page.evaluate('({calls:__rail.game.renderer.info.render.calls,tris:__rail.game.renderer.info.render.triangles})')),flush=True)
    print('errors:',errs,flush=True)
    b.close()
