from playwright.sync_api import sync_playwright
from pathlib import Path
import sys,json
sys.stdout.reconfigure(encoding='utf-8')
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True,args=['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist',
        '--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'])
    page=b.new_page(viewport={'width':1280,'height':720})
    page.goto(Path('outputs/neon-rail/NEON RAIL.html').resolve().as_uri()+'?qa',wait_until='networkidle')
    page.wait_for_function('!!window.__rail',timeout=60000)
    page.evaluate("__rail.game.motionControl.enable()")
    page.wait_for_timeout(6000)
    print(json.dumps(page.evaluate("""({
      active:__rail.game.motionControl.active,
      streaming:__rail.game.motionControl.streaming,
      status:__rail.game.motionControl.status,
      hasProcessor: typeof MediaStreamTrackProcessor!=='undefined',
      cores: navigator.hardwareConcurrency})""")),flush=True)
    b.close()
