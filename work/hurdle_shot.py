from playwright.sync_api import sync_playwright
from pathlib import Path
import sys,json
sys.stdout.reconfigure(encoding='utf-8')
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True,args=['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist'])
    page=b.new_page(viewport={'width':1600,'height':900})
    page.goto(Path('outputs/neon-rail/NEON RAIL.html').resolve().as_uri()+'?qa',wait_until='networkidle')
    page.wait_for_function('!!window.__rail')
    page.get_by_role('button',name='LET’S RUN').click()
    page.evaluate('__rail.game.testClock=true;__rail.game.audio.enabled=false;__rail.clear()')
    # park a hurdle right in front of the camera so it can be judged
    page.evaluate('__rail.spawn("hurdle",1,14);__rail.spawn("hurdle",0,26);__rail.spawn("cargo",2,26);__rail.advance(0.1);__rail.game.render(1/60)')
    page.wait_for_timeout(400); page.screenshot(path='work/hurdle-check.png'); print('wrote work/hurdle-check.png',flush=True)
    print(json.dumps(page.evaluate('({calls:__rail.game.renderer.info.render.calls,tris:__rail.game.renderer.info.render.triangles})')),flush=True)
    b.close()
