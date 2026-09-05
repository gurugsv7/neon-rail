from playwright.sync_api import sync_playwright
from pathlib import Path
import json,sys
sys.stdout.reconfigure(encoding='utf-8')
out=[]
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,args=['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist'])
    page=b.new_page(viewport={'width':1366,'height':768})
    page.goto(Path('outputs/neon-rail/NEON RAIL.html').resolve().as_uri()+'?qa',wait_until='networkidle')
    page.wait_for_function('!!window.__rail')
    for w,h in [(1366,768),(1920,1080),(2560,1440)]:
        page.set_viewport_size({'width':w,'height':h})
        page.evaluate('__rail.game.start();__rail.clear();__rail.game.audio.enabled=false')
        page.wait_for_timeout(600)
        page.evaluate('window.ft=[];window.lt=performance.now();window.sample=t=>{ft.push(t-lt);lt=t;if(ft.length<180)requestAnimationFrame(sample)};requestAnimationFrame(sample)')
        page.wait_for_function('ft.length>=180',timeout=60000)
        r=page.evaluate('(()=>{const f=ft.slice(10),s=[...f].sort((a,b)=>a-b);return {mean_ms:f.reduce((a,b)=>a+b)/f.length,p95_ms:s[Math.floor(s.length*.95)],renderWidth:__rail.game.renderer.domElement.width,renderHeight:__rail.game.renderer.domElement.height}})()')
        r.update(width=w,height=h);out.append(r);print(r,flush=True)
    b.close()
json.dump(out,open('work/release-performance.json','w'),indent=2)
