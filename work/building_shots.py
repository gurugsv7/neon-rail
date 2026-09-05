from playwright.sync_api import sync_playwright
from pathlib import Path
import sys,json
sys.stdout.reconfigure(encoding='utf-8')
shots=[('work/building-street.png',12),('work/building-street-2.png',22)]
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True,args=['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist'])
    page=b.new_page(viewport={'width':1600,'height':900})
    page.goto(Path('outputs/neon-rail/NEON RAIL.html').resolve().as_uri()+'?qa',wait_until='networkidle')
    page.wait_for_function('!!window.__rail')
    page.get_by_role('button',name='LET’S RUN').click()
    page.evaluate('__rail.game.testClock=true;__rail.game.audio.enabled=false;__rail.clear()')
    for path,secs in shots:
        page.evaluate(f'__rail.advance({secs});__rail.game.render(1/60)')
        page.wait_for_timeout(250)
        page.screenshot(path=path)
        print('wrote',path,flush=True)
    stats=page.evaluate('''(()=>{const g=__rail.game;const l=[];g.scene.traverse(o=>{if(o.isLOD)l.push(o);});
      const by=[0,0,0,0];l.forEach(x=>by[x.getCurrentLevel()]++);
      return {houses:l.length,byLevel:by,drawCalls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles};})()''')
    print(json.dumps(stats),flush=True)
    b.close()
