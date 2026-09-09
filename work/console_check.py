from playwright.sync_api import sync_playwright
from pathlib import Path
import sys
sys.stdout.reconfigure(encoding='utf-8')
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True,args=['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist'])
    page=b.new_page(viewport={'width':1200,'height':800})
    msgs=[]
    page.on('console',lambda m:msgs.append(m.type+': '+m.text[:130]))
    page.on('pageerror',lambda e:msgs.append('pageerror: '+str(e)[:130]))
    page.goto(Path('outputs/neon-rail/NEON RAIL.html').resolve().as_uri(),wait_until='networkidle')
    page.wait_for_timeout(3000)
    noisy=[m for m in msgs if not m.startswith('log:')]
    print('console (game load, camera off):')
    for m in noisy or ['  (clean)']: print('  '+m)
    b.close()
