from playwright.sync_api import sync_playwright
from pathlib import Path
import sys
sys.stdout.reconfigure(encoding='utf-8')
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True,args=['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist'])
    page=b.new_page(viewport={'width':1200,'height':800})
    errs=[]; page.on('pageerror',lambda e:errs.append(str(e)))
    page.goto(Path('outputs/neon-rail/NEON RAIL.html').resolve().as_uri()+'?qa',wait_until='networkidle')
    page.wait_for_function('!!window.__rail')
    page.get_by_role("button",name="LET’S RUN").click()
    page.evaluate('__rail.game.testClock=true;__rail.game.audio.enabled=false;__rail.clear()')
    page.evaluate('__rail.power("shield");__rail.advance(3);__rail.game.render(1/60)')
    page.wait_for_timeout(300); page.screenshot(path='work/shield.png'); print('wrote work/shield.png',flush=True)
    print('errors:',errs[:3],flush=True)
    b.close()
