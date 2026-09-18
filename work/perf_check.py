from pathlib import Path
from playwright.sync_api import sync_playwright
import json,sys
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,args=['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist'])
 p=b.new_page(viewport={'width':1440,'height':900});errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
 p.goto('http://127.0.0.1:8765/NEON%20RAIL.html?qa',wait_until='networkidle',timeout=60000);p.wait_for_function('!!window.__rail',timeout=60000)
 p.evaluate('__rail.game.testClock=true;__rail.game.start();__rail.clear();__rail.game.distance=390;__rail.game.world.step(0,__rail.game);__rail.game.audio.enabled=false')
 p.wait_for_timeout(1500)
 p.screenshot(path='work/performance-scene.png')
 r=p.evaluate('''async()=>{const samples=[];let last=performance.now();for(let i=0;i<150;i++){await new Promise(requestAnimationFrame);if(__rail.game.testClock){__rail.game.step(1/120);__rail.game.step(1/120);}const now=performance.now();samples.push(now-last);last=now;}samples.sort((a,b)=>a-b);return {median:samples[75],p95:samples[142],over33:samples.filter(x=>x>33.4).length,snapshot:__rail.snapshot(),canvas:[__rail.game.renderer.domElement.width,__rail.game.renderer.domElement.height]}}''')
 r['errors']=errors;print(json.dumps(r));Path('work/perf-'+sys.argv[1]+'.json').write_text(json.dumps(r));b.close()
