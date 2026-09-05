from playwright.sync_api import sync_playwright
import sys,json
sys.stdout.reconfigure(encoding='utf-8')
with sync_playwright() as p:
    for label,args in [('default',['--enable-webgl','--ignore-gpu-blocklist']),('gpu',['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist'])]:
        b=p.chromium.launch(headless=True,args=args)
        page=b.new_page(viewport={'width':1366,'height':768})
        page.goto('http://127.0.0.1:8765/NEON%20RAIL.html?qa',wait_until='networkidle')
        page.wait_for_function('!!window.__rail')
        data=page.evaluate('''()=>{const g=__rail.game,gl=g.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');g.testClock=true;return {vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):null,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,info:g.snapshot()}}''')
        print(label,json.dumps(data),flush=True)
        for quality in ['normal','no-shadows','half-resolution']:
            if quality=='no-shadows':page.evaluate('__rail.game.renderer.shadowMap.enabled=false')
            if quality=='half-resolution':page.evaluate('__rail.game.renderer.setPixelRatio(.65)')
            page.evaluate('window.ft=[];window.lt=performance.now();window.sample=t=>{ft.push(t-lt);lt=t;if(ft.length<45)requestAnimationFrame(sample)};requestAnimationFrame(sample)')
            page.wait_for_function('ft.length>=45',timeout=60000)
            print(label,quality,page.evaluate('ft.slice(5).reduce((a,b)=>a+b,0)/(ft.length-5)'),flush=True)
        b.close()
