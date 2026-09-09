from playwright.sync_api import sync_playwright
from pathlib import Path
import sys,json
sys.stdout.reconfigure(encoding='utf-8')
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True,args=['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist',
        '--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'])
    page=b.new_page(viewport={'width':1280,'height':800})
    page.goto(Path('outputs/neon-rail/NEON RAIL.html').resolve().as_uri()+'?qa',wait_until='networkidle')
    page.wait_for_function('!!window.__rail',timeout=60000)
    page.get_by_role("button",name="LET’S RUN").click()
    page.evaluate('__rail.game.testClock=true;__rail.game.audio.enabled=false;__rail.clear();__rail.advance(3)')
    page.evaluate("__rail.game.motionControl.enable()")
    page.wait_for_timeout(5000)
    page.evaluate('__rail.game.render(1/60)')
    page.wait_for_timeout(400)
    page.screenshot(path='work/motion-ui.png'); print('wrote work/motion-ui.png',flush=True)
    # cost with the camera loop live
    r=page.evaluate("""async()=>{const g=__rail.game,gl=g.renderer.getContext();
      const bench=()=>{const t=[];for(let i=0;i<40;i++){const s=performance.now();g.render(1/60);gl.finish();t.push(performance.now()-s);}
        t.sort((a,b)=>a-b);return +t[20].toFixed(2);};
      bench(); const on=bench();
      g.motionControl.disable(); await new Promise(r=>setTimeout(r,400));
      bench(); const off=bench();
      return {renderMsMotionOn:on,renderMsMotionOff:off,delta:+(on-off).toFixed(2)};}""")
    print('render cost:',json.dumps(r),flush=True)
    b.close()
