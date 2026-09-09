from playwright.sync_api import sync_playwright
from pathlib import Path
import sys,json,statistics
sys.stdout.reconfigure(encoding='utf-8')
# gl.finish() forces the GPU to complete, which made this measurement stable
# earlier where the rAF sampler did not.
BENCH = """()=>{const g=__rail.game,gl=g.renderer.getContext();
  const one=()=>{const t=[];for(let i=0;i<50;i++){const s=performance.now();g.render(1/60);gl.finish();t.push(performance.now()-s);}
    t.sort((a,b)=>a-b);return +t[25].toFixed(2);};
  one(); return [one(),one(),one()];}"""
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True,args=['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist'])
    for w,h in ((1920,1080),(2560,1440)):
        page=b.new_page(viewport={'width':w,'height':h})
        page.goto(Path('outputs/neon-rail/NEON RAIL.html').resolve().as_uri()+'?qa',wait_until='networkidle')
        page.wait_for_function('!!window.__rail',timeout=60000)
        page.get_by_role("button",name="LET’S RUN").click()
        page.evaluate('__rail.game.testClock=true;__rail.game.audio.enabled=false;__rail.clear();__rail.advance(4)')
        r=page.evaluate(BENCH)
        print(f'{w}x{h} render ms (3 runs): {r}  median {statistics.median(r)}',flush=True)
        page.close()
    b.close()
