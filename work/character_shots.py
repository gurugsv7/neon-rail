from playwright.sync_api import sync_playwright
from pathlib import Path
import sys,json
sys.stdout.reconfigure(encoding='utf-8')
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True,args=['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist'])
    page=b.new_page(viewport={'width':1500,'height':850})
    errs=[]; page.on('pageerror',lambda e:errs.append(str(e)))
    page.on('console',lambda m:errs.append('console:'+m.text) if m.type=='error' else None)
    page.goto(Path('outputs/neon-rail/NEON RAIL.html').resolve().as_uri()+'?qa',wait_until='networkidle')
    page.wait_for_function('!!window.__rail')
    page.wait_for_timeout(1500)
    page.screenshot(path='work/char-menu.png'); print('menu shot',flush=True)
    page.get_by_role("button",name="LET’S RUN").click()
    page.evaluate('__rail.game.testClock=true;__rail.game.audio.enabled=false;__rail.clear()')
    page.evaluate('__rail.advance(3);__rail.game.render(1/60)')
    page.wait_for_timeout(300); page.screenshot(path='work/char-run.png'); print('run shot',flush=True)
    # slide
    page.evaluate('__rail.game.player.duck();for(let i=0;i<14;i++){__rail.game.step(1/120);}__rail.game.render(1/60)')
    page.wait_for_timeout(200); page.screenshot(path='work/char-slide.png'); print('slide shot',flush=True)
    # jump
    page.evaluate('''(()=>{const g=__rail.game;g.player.slide=0;for(let i=0;i<30;i++)g.step(1/120);
      g.player.jump();for(let i=0;i<26;i++)g.step(1/120);g.render(1/60);})()''')
    page.wait_for_timeout(200); page.screenshot(path='work/char-jump.png'); print('jump shot',flush=True)
    print(json.dumps(page.evaluate('({calls:__rail.game.renderer.info.render.calls,tris:__rail.game.renderer.info.render.triangles,rig:!!__rail.game.rig})')),flush=True)
    print('errors:',errs[:4],flush=True)
    b.close()
