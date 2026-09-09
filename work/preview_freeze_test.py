from playwright.sync_api import sync_playwright
from pathlib import Path
import sys,json
sys.stdout.reconfigure(encoding='utf-8')
# The earlier version of this checked video.currentTime, which was live even
# while the panel was frozen -- the freeze was in the repaint, not the camera.
# So sample the preview CANVAS itself and require the pixels to change.
PROBE = """async ()=>{
  const cv=document.getElementById('motionview');
  const ctx=cv.getContext('2d',{willReadFrequently:true});
  const grab=()=>Array.from(ctx.getImageData(0,0,cv.width,cv.height).data);
  const diff=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])>6)n++;return n;};
  const shots=[];
  for(let i=0;i<4;i++){ shots.push(grab()); await new Promise(r=>setTimeout(r,700)); }
  const changes=[diff(shots[0],shots[1]),diff(shots[1],shots[2]),diff(shots[2],shots[3])];
  const pixels=cv.width*cv.height;
  return {changedPixelsPerSample:changes, pixels,
          blank: shots[3].every(v=>v===0),
          status: __rail.game.motionControl.status};
}"""
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True,args=['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist',
        '--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'])
    page=b.new_page(viewport={'width':1280,'height':720})
    errs=[]; page.on('pageerror',lambda e:errs.append(str(e)))
    page.goto(Path('outputs/neon-rail/NEON RAIL.html').resolve().as_uri()+'?qa',wait_until='networkidle')
    page.wait_for_function('!!window.__rail',timeout=60000)
    page.get_by_role("button",name="LET’S RUN").click()
    page.evaluate("__rail.game.audio.enabled=false; __rail.game.motionControl.enable()")
    page.wait_for_timeout(6000)
    r=page.evaluate(PROBE)
    live = all(c > r['pixels']*0.01 for c in r['changedPixelsPerSample'])
    print('preview canvas:',json.dumps(r),flush=True)
    print(('PASS' if live else 'FAIL'),'self-view keeps repainting while tracking',flush=True)
    # and the permission prompt must not have paused the run
    print('game state:',page.evaluate("__rail.game.state"),flush=True)
    print('errors:',errs[:2],flush=True)
    b.close()
    sys.exit(0 if live and not errs else 1)
