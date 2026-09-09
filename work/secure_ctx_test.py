from playwright.sync_api import sync_playwright
from pathlib import Path
import sys,json
sys.stdout.reconfigure(encoding='utf-8')
probe = """()=>({
  isSecureContext: window.isSecureContext,
  origin: location.origin,
  protocol: location.protocol,
  hasMediaDevices: !!(navigator.mediaDevices),
  hasGetUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
  hasFaceDetector: typeof window.FaceDetector !== 'undefined',
  crossOriginIsolated: window.crossOriginIsolated,
})"""
html = Path('work/probe.html'); html.write_text("<!doctype html><title>probe</title><body>probe</body>")
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True,args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'])
    page=b.new_page()
    # 1) file:// — how PLAY.cmd opens the game
    page.goto(html.resolve().as_uri())
    print('file://   ',json.dumps(page.evaluate(probe)),flush=True)
    try:
        r=page.evaluate("""async()=>{try{const s=await navigator.mediaDevices.getUserMedia({video:true});
          const t=s.getVideoTracks()[0].getSettings(); s.getTracks().forEach(x=>x.stop());
          return {ok:true,settings:{w:t.width,h:t.height}};}catch(e){return {ok:false,err:e.name+': '+e.message};}}""")
        print('file:// getUserMedia ->',json.dumps(r),flush=True)
    except Exception as e:
        print('file:// getUserMedia threw:',e,flush=True)
    # 2) http://localhost — how the dev server serves it
    page.goto('http://localhost:8127/work/probe.html')
    print('localhost',json.dumps(page.evaluate(probe)),flush=True)
    r=page.evaluate("""async()=>{try{const s=await navigator.mediaDevices.getUserMedia({video:true});
      const t=s.getVideoTracks()[0].getSettings(); s.getTracks().forEach(x=>x.stop());
      return {ok:true,settings:{w:t.width,h:t.height}};}catch(e){return {ok:false,err:e.name+': '+e.message};}}""")
    print('localhost getUserMedia ->',json.dumps(r),flush=True)
    b.close()
